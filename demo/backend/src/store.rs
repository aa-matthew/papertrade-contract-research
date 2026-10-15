use anyhow::Result;
use rusqlite::{Connection, params};
use serde_json::{Value, json};
use std::sync::{Arc, Mutex};

#[derive(Clone)]
pub struct Store(pub Arc<Mutex<Connection>>);
impl Store {
    pub fn open(path: &str) -> Result<Self> {
        let c = Connection::open(path)?;
        c.busy_timeout(std::time::Duration::from_secs(2))?;
        c.execute_batch(include_str!("../schema.sql"))?;
        Ok(Self(Arc::new(Mutex::new(c))))
    }
    pub fn commit(&self, value: &Value) -> Result<()> {
        let mut db = self
            .0
            .lock()
            .map_err(|_| anyhow::anyhow!("database lock"))?;
        let tx = db.transaction()?;
        let identity = value["stateVersion"].as_str().unwrap_or_default();
        let epoch = format!(
            "{}:{}",
            value["engineId"].as_str().unwrap_or_default(),
            value["chainEpoch"]
        );
        let old: Option<String> = tx
            .query_row("SELECT epoch FROM current_state WHERE id=1", [], |r| {
                r.get(0)
            })
            .ok();
        if old.as_deref() != Some(&epoch) {
            tx.execute("UPDATE transactions SET canonical=0", [])?;
        }
        tx.execute("INSERT INTO current_state(id,version,epoch,block_number,block_hash,payload,indexed_at) VALUES(1,?1,?2,?3,?4,?5,unixepoch()) ON CONFLICT(id) DO UPDATE SET version=excluded.version,epoch=excluded.epoch,block_number=excluded.block_number,block_hash=excluded.block_hash,payload=excluded.payload,indexed_at=excluded.indexed_at",
            params![identity,epoch,value["block"].as_i64(),value["blockHash"].as_str(),value.to_string()])?;
        tx.execute("DELETE FROM projection", [])?;
        for kind in ["accounts", "markets", "positions", "orders", "claims"] {
            if let Some(rows) = value[kind].as_array() {
                for (i, row) in rows.iter().enumerate() {
                    let key = row
                        .get("id")
                        .or_else(|| row.get("index"))
                        .map(|v| v.to_string())
                        .unwrap_or(i.to_string());
                    tx.execute(
                        "INSERT INTO projection(kind,row_key,payload) VALUES(?1,?2,?3)",
                        params![kind, key, row.to_string()],
                    )?;
                }
            }
        }
        if let Some(rows) = value["journal"].as_array() {
            for r in rows {
                let hash = r["hash"].as_str().unwrap_or_default();
                tx.execute("INSERT INTO transactions(hash,epoch,block_number,canonical,payload) VALUES(?1,?2,?3,1,?4) ON CONFLICT(hash) DO UPDATE SET epoch=excluded.epoch,block_number=excluded.block_number,canonical=1,payload=excluded.payload", params![hash,epoch,r["block"].as_i64(),r.to_string()])?;
                tx.execute("DELETE FROM events WHERE tx_hash=?1", [hash])?;
                if let Some(events) = r["events"].as_array() {
                    for (i, e) in events.iter().enumerate() {
                        tx.execute(
                            "INSERT INTO events(tx_hash,log_index,payload) VALUES(?1,?2,?3)",
                            params![hash, i as i64, e.to_string()],
                        )?;
                    }
                }
            }
        }
        tx.execute("DELETE FROM observations", [])?;
        if let Some(markets) = value["markets"].as_array() {
            for m in markets {
                if let Some(history) = m["history"].as_array() {
                    for (i, q) in history.iter().enumerate() {
                        tx.execute("INSERT INTO observations(market_id,observation_index,chain_time,price) VALUES(?1,?2,?3,?4)",params![m["id"].as_i64(),i as i64,q["time"].as_i64(),q["price"].to_string()])?;
                    }
                }
            }
        }
        // Bound retained noncanonical proof. Current projection is always rebuilt atomically.
        tx.execute("DELETE FROM transactions WHERE canonical=0 AND hash NOT IN (SELECT hash FROM transactions ORDER BY rowid DESC LIMIT 5000)",[])?;
        tx.commit()?;
        Ok(())
    }
    pub fn load(&self, version: &str) -> Result<Option<Value>> {
        let db = self
            .0
            .lock()
            .map_err(|_| anyhow::anyhow!("database lock"))?;
        let payload: Option<String> = db
            .query_row(
                "SELECT payload FROM current_state WHERE id=1 AND version=?1",
                [version],
                |r| r.get(0),
            )
            .ok();
        Ok(payload.map(|s| serde_json::from_str(&s)).transpose()?)
    }
    pub fn inspect(&self) -> Result<Value> {
        let db = self
            .0
            .lock()
            .map_err(|_| anyhow::anyhow!("database lock"))?;
        let mut counts = serde_json::Map::new();
        for kind in ["accounts", "markets", "positions", "orders", "claims"] {
            let n: i64 = db.query_row(
                "SELECT count(*) FROM projection WHERE kind=?1",
                [kind],
                |r| r.get(0),
            )?;
            counts.insert(kind.to_string(), json!(n));
        }
        for (key, sql) in [
            (
                "canonicalTransactions",
                "SELECT count(*) FROM transactions WHERE canonical=1",
            ),
            (
                "revertedOrPreviousEpochTransactions",
                "SELECT count(*) FROM transactions WHERE canonical=0",
            ),
            (
                "canonicalEvents",
                "SELECT count(*) FROM events JOIN transactions ON transactions.hash=events.tx_hash WHERE canonical=1",
            ),
            ("observations", "SELECT count(*) FROM observations"),
        ] {
            let n: i64 = db.query_row(sql, [], |r| r.get(0))?;
            counts.insert(key.to_string(), json!(n));
        }
        let mut q=db.prepare("SELECT payload FROM transactions WHERE canonical=1 ORDER BY block_number DESC LIMIT 50")?;
        let receipts = q
            .query_map([], |r| r.get::<_, String>(0))?
            .filter_map(|r| r.ok())
            .filter_map(|s| serde_json::from_str::<Value>(&s).ok())
            .collect::<Vec<_>>();
        let meta:Option<Value>=db.query_row("SELECT version,epoch,block_number,block_hash,indexed_at FROM current_state WHERE id=1",[],|r|Ok(json!({"version":r.get::<_,String>(0)?,"epoch":r.get::<_,String>(1)?,"block":r.get::<_,i64>(2)?,"blockHash":r.get::<_,String>(3)?,"indexedAtUnix":r.get::<_,i64>(4)?}))).ok();
        Ok(
            json!({"database":"SQLite WAL","schemaVersion":1,"current":meta,"counts":counts,"transactions":receipts}),
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn fixture(epoch: u64, hash: &str) -> Value {
        json!({"engineId":"fixture","chainEpoch":epoch,"stateVersion":format!("v{epoch}{hash}"),"block":10,"blockHash":hash,"accounts":[{"index":6,"available":"9007199254740993000000"}],"markets":[{"id":1,"history":[{"time":1000,"price":80000}]}],"positions":[{"id":2}],"orders":[],"claims":[],"journal":[{"hash":hash,"block":10,"events":[{"name":"Closed"}]}]})
    }
    #[test]
    fn atomic_projection_preserves_integer_strings_and_idempotent_events() {
        let s = Store::open(":memory:").unwrap();
        let f = fixture(0, "0xaa");
        s.commit(&f).unwrap();
        s.commit(&f).unwrap();
        let i = s.inspect().unwrap();
        assert_eq!(i["counts"]["canonicalEvents"], 1);
        assert_eq!(
            s.load(f["stateVersion"].as_str().unwrap())
                .unwrap()
                .unwrap()["accounts"][0]["available"],
            "9007199254740993000000"
        );
    }
    #[test]
    fn revert_epoch_hides_old_transactions_and_replaces_active_projection() {
        let s = Store::open(":memory:").unwrap();
        s.commit(&fixture(0, "0xaa")).unwrap();
        let mut f = fixture(1, "0xbb");
        f["positions"] = json!([]);
        s.commit(&f).unwrap();
        let i = s.inspect().unwrap();
        assert_eq!(i["counts"]["positions"], 0);
        assert_eq!(i["counts"]["canonicalTransactions"], 1);
        assert_eq!(i["counts"]["revertedOrPreviousEpochTransactions"], 1);
        assert!(s.load("v00xaa").unwrap().is_none());
    }
    #[test]
    fn remined_transaction_hash_updates_its_canonical_block() {
        let store = Store::open(":memory:").unwrap();
        store.commit(&fixture(0, "0xaa")).unwrap();
        let mut next = fixture(1, "0xaa");
        next["block"] = json!(20);
        next["blockHash"] = json!("0xbb");
        next["journal"][0]["block"] = json!(20);
        store.commit(&next).unwrap();
        let block: i64 = store
            .0
            .lock()
            .unwrap()
            .query_row(
                "SELECT block_number FROM transactions WHERE hash='0xaa'",
                [],
                |r| r.get(0),
            )
            .unwrap();
        assert_eq!(block, 20);
    }
}
