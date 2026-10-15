PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS current_state(id INTEGER PRIMARY KEY CHECK(id=1), version TEXT NOT NULL, epoch TEXT NOT NULL, block_number INTEGER NOT NULL, block_hash TEXT NOT NULL, payload TEXT NOT NULL, indexed_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS projection(kind TEXT NOT NULL,row_key TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(kind,row_key));
CREATE TABLE IF NOT EXISTS transactions(hash TEXT PRIMARY KEY,epoch TEXT NOT NULL,block_number INTEGER,canonical INTEGER NOT NULL CHECK(canonical IN(0,1)),payload TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS tx_canonical_block ON transactions(canonical,block_number DESC);
CREATE TABLE IF NOT EXISTS events(tx_hash TEXT NOT NULL REFERENCES transactions(hash) ON DELETE CASCADE,log_index INTEGER NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(tx_hash,log_index));
CREATE TABLE IF NOT EXISTS observations(market_id INTEGER NOT NULL,observation_index INTEGER NOT NULL,chain_time INTEGER,price TEXT NOT NULL,PRIMARY KEY(market_id,observation_index));
PRAGMA user_version=1;
