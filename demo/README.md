# Robinpaper: your local Robinhood fork lab

Open **http://127.0.0.1:4173** on this computer. The lab runs a pinned Robinhood mainnet fork with a separate local chain ID **31337**, reconstructed Solidity math, functional protocol contracts and ten funded actor wallets. All collateral is **LABUSD with no real value**.

## First five minutes

1. Start as **06 Alice**. Trade shows a seeded BTC long and $9,500 available margin. Open another long or switch market to ETH. Auto-execution commits an order, advances the local clock and executes through the keeper against a later scenario observation.
2. Switch to **02 Oracle operator → Operations**. Publish a different price. Switch back to Alice and close the position; inspect its receipt in History.
3. Switch to **07 Bob** for a seeded ETH short. Move ETH against the short and use **04 Liquidator** to liquidate it. Losing settlements mint PART using the recovered curve.
4. Switch to **08 Carol → Paper**. Inspect the stake created from a real local liquidation, claim funded rewards, then unstake/restake.
5. Try **01 Guardian → Operations → Pause openings**. **00 Governor** must schedule an unpause, wait a day (or advance this lab's clock), then execute through the actual timelock.
6. **09 Session relayer** can sign Alice's orders within her seeded budget. Alice can revoke; pending session orders then reject execution.

[Wallet roles](docs/WALLETS.md) · [UI reconstruction](docs/UI-RECONSTRUCTION.md) · [Function coverage](docs/FUNCTION-COVERAGE.md) · [Verification](docs/VERIFICATION.md)

## Start, stop and resume

From the repository root, install the already pinned protocol dependencies once with `npm ci --prefix protocol`. Node.js 20.11+ and Foundry `anvil` must be available.

```sh
npm run up --prefix demo      # detached local service; preserves state
npm run status --prefix demo
npm run down --prefix demo    # graceful shutdown / state save
```

Foreground alternative: `npm start --prefix demo`. First start compiles and deploys; later starts load the saved chain state and deployment. UI: port **4173**; JSON-RPC: port **9545**; pinned read-only source cache: port **9546**. Both bind only to 127.0.0.1. Close/reopen the page without losing chain state. The machine must be awake for services to respond. No public hosting, real-money bridge or mainnet transaction is involved.

Anvil state is saved every 15 seconds and on graceful exit. Avoid running two instances. Don't delete `.runtime/` unless you intend to discard the lab; preserve/rename that directory for a fresh deployment. After contract source edits, stop the lab, build with `npm run compile --prefix demo`, and start a fresh runtime rather than treating old addresses as upgraded.

## What is really deployed

`demo/contracts/LabContracts.sol` defines `ReconstructedLabExchange`, a local-only subclass of our `protocol/src/Exchange.sol`. Its PnL and loss emission hooks **directly call** the checked-in research libraries:

- `reverse-engineered/settlement/SettlementMath.reconstructed.sol`
- `reverse-engineered/token/MintCurve.reconstructed.sol`

Original research files are unchanged. Compiler source hashes and deployed runtime sizes are recorded in [build-info.json](build-info.json). Deployment addresses, runtime hashes and receipts are in ignored `.runtime/deployment.local.json`; the Contracts page displays addresses and source fork evidence. The server refuses a different chain ID or mismatching deployed code.

This is **not** recovered original full Papertrade source. Custody, authorization, delayed orders, FIFO payout accounting and governance use our v0.1 code; BBO/HyperCore and real collateral are replaced with explicit local fixtures. Original full Exchange/Queue source remains unavailable. The full research archive remains in the parent repository.

## Oracle and economic rules

`npm run seed:chart --prefix demo` optionally publishes a deterministic chart scenario; each point is a real local oracle transaction.

BTC/ETH prices are operator-controlled test scenarios, not authenticated Chainlink reports or live execution quotes. Role 02 alone can publish; a local heartbeat refreshes the same current prices every 10 seconds to avoid idle staleness. The chart contains actual local publication observations, not invented market candles. Use Operations to stop heartbeat and test stale prices.

Lab parameters use the inspected Papertrade-style impact defaults: 10% base haircut, rate multiplier 15,000, reference notional $100,000, BTC position multiplier 814.598 / ETH 483.979; leverage is capped at **100×**. Prices are WAD externally, restricted to 8-decimal-compatible values for the recovered helper. Native collateral is 6 decimals.

Net trader-profit credits share a fixed **5m LABUSD per UTC day** allowance across direct closes and FIFO harvests. Excess queues. Principal and already credited cash remain withdrawable. This is separate from the surplus cap and is not a rolling 24-hour limit or solvency guarantee. Seed capital is a donation, not a redeemable LP deposit.

## Ten wallets and access

Use the actor selector without a browser-wallet extension. The local backend submits real transactions from the selected unlocked Anvil actor; helper services use the explicitly named oracle/keeper/treasury actors. A role label cannot bypass contract access control. For an external wallet, download the **test-only** key export from Actors and add local network 31337 / RPC http://127.0.0.1:9545 / ETH.

Private-key exports and chain state are local-only, gitignored, and written with owner-only file permissions. Keys are the publicly known Anvil development keys; **never fund them on any public chain**. The source fork already had EIP-7702 delegation code at these known addresses. Deployment explicitly clears code on only these ten local accounts to obtain plain EOA fixtures, recording the overrides; source chain state is untouched.

There is no remote transaction signer. The upstream Robinhood endpoint is used only for fork reads. Operator-specific source RPC can be provided via `ROBINHOOD_FORK_URL`; source chain must be 4663. The default is the Robinhood-documented Pinax endpoint. Startup verifies chain ID, pinned block hash and a historical storage read; the official public RPC pruned the pinned state during testing, so it is unsuitable for durable replay here. A read-only local source cache on port 9546 persists verified fork reads. For contracts successfully CREATEd after the source block, cold source-baseline storage is zero; the cache explicitly preserves that fact after Anvil dump/load. It never zero-fills arbitrary source contracts or falls back to latest state. Uncached unrelated Robinhood state still requires archive-provider availability and network access. No provider credential is bundled.

## Live Binance oracle experiment

```sh
npm run simulate:binance --prefix demo -- 8
npm run test:feed --prefix demo
```

Runs a bounded live experiment (5–60 seconds, default 8), targeting one poll per second. It reads BTCUSDT/ETHUSDT spot last prices from Binance's [public market-data API](https://github.com/binance/binance-spot-api-docs/blob/master/faqs/market_data_only.md), checks both symbols, positive exact prices and source timestamps (maximum age 10 seconds), then publishes actual local oracle transactions as actor 02. It rejects bad/stale/network responses rather than inventing prices. This is spot data, not futures mark/index data; USDT is treated as LABUSD only for the experiment.

The script checkpoints the existing chain/metadata, disables the fixed-price heartbeat temporarily, opens and closes Alice BTC long and Bob ETH short through the normal delayed keeper flow, and exercises Carol's funded reward claim/unstake/restake. It stops polling, restores the original state and heartbeat, and exits. Duration covers the observation loop; setup/settlement/cleanup take additional time. It respects intentional pauses/retirements and refuses an active QA checkpoint. Avoid manual transactions during this test. Results are stored in ignored `.runtime/binance-simulation.local.json`; the verified sample is published in [binance-simulation-report.json](binance-simulation-report.json). Receipt hashes from this reverted experiment cannot be queried on the restored chain.

This adapter is a single offchain publisher for local tests; it is not a decentralized or authenticated production oracle. The usual local fixed-price heartbeat resumes afterwards; the Binance feed stays off until explicitly run again.

## Tests and tools

```sh
npm test --prefix demo       # requires running lab; snapshots and restores scenario state
npm test --prefix protocol   # standalone core + oracle tests, separate ephemeral Anvil
npm test                    # existing archive integrity checks
```

The demo API tests temporarily stop heartbeat, snapshot/revert both chain and backend metadata, then restore heartbeat. Do not interact manually during the test run. Regression tests exercise signature revocation, real recovered PnL floors, roles, custody, liquidation, staking, retirement, governance and daily-cap queues. They are local integration tests, not a production security audit.

The contract console exposes each deployed public ABI for view and write calls, with ordinary onchain permissions. Keeper operations, source hashes, transaction receipts, simulated clock controls and wallet export are accessible in the app. Diagnostics/logs live under `.runtime/` and never enter Git.
