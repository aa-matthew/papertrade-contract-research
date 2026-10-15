# Verification and handoff

Verified 16 October 2026 (Vietnam time). The saved machine-readable [report](../verification-report.json) contains the pinned source anchor, deployed local addresses/runtime hashes, health results and actual browser transaction receipts. These addresses and hashes refer to this saved local instance; a new deployment will produce a different manifest.

## Result

- 16 demo integration tests passed against the running fork; each restores chain and backend metadata through checkpoints.
- 12 standalone protocol tests passed.
- 8 research archive integrity tests passed.
- 3 Binance quote-validation tests passed (freshness, symbol completeness and decimal/positive-price rejection).
- 36 read-only health checks passed, including all six deployed runtime hashes, source hashes, ten funded actors, timelock ownership, custody accounting and the fixed daily payout allowance.
- Stop/start persistence was exercised; deployed addresses, actor EOA overrides, positions and oracle observations survived restart.

The integration suite covers deposits/withdrawals, delayed open/close orders, cancellation, keeper execution, recovered integer PnL, loss minting, liquidation, staking, session signatures/revocation, delayed governance, frozen-price retirement, shared 5m daily profit credits/FIFO queues, stale and paused oracle behavior, actor isolation and local HTTP origin checks. Source-cache tests cover the pinned block, locally created contract baselines and rejection of upstream mutations.

## Browser verification

The reference Trade, House and Paper pages were inspected read-only. In the local UI, Alice deposited 100 LABUSD, opened a BTC position through commit/keeper execution, closed it, then withdrew 100 LABUSD. All actions produced successful onchain receipts; the temporary position closed and Alice returned to the seeded balance. Actual transaction hashes are in the public report. The contract console returned the 5m allowance through an ABI view call. House, staking and ten actor views were inspected. Desktop and 390px mobile layouts were checked, with no horizontal page overflow on the mobile actor/contract pages. Browser error logs were empty at the final console check.

Screenshots: [Trade](screenshots/trade-desktop.png), [House](screenshots/house-desktop.png), [Staking](screenshots/staking-desktop.png), [Mobile actors](screenshots/actors-mobile.png).

## Corrections verified

- Source-fork development accounts carried EIP-7702 delegation code. Only the ten local fixture accounts are explicitly cleared to plain EOAs, preserving ECDSA session behavior; source state is untouched.
- Retired-market closes use the frozen settlement quote for default slippage limits.
- A persistent read-only fork cache preserves locally created storage baselines across Anvil restarts. Unknown original-source state still requires an available archive provider; it is never silently replaced with zero or latest state.
- Transaction failures retain a committed order ID for retry/cancel instead of presenting a failed execution as a successful fill.
- Local form drafts and ABI output survive state polling. Mobile navigation and long wallet addresses fit the viewport.

## Resume and later checks

Run `npm run status --prefix demo`, then `npm run check --prefix demo`. If stopped, `npm run up --prefix demo` resumes saved state. Do not delete `.runtime`, redeploy, or reset the chain during an ordinary health check. Preserve user-created orders, prices, pauses and retirement state. Run integration tests only when nobody is interacting: they temporarily checkpoint and restore the lab. Read-only health checks are suitable during active use.

The scheduled 07:00 Vietnam follow-up should use the existing deployment, preserve user activity and report meaningful changes. The computer and Codex must be awake for the local service/follow-up to run.

## Limits

This is a functional local demonstration, not a security audit or production deployment. PnL and loss-token emissions call reconstructed research helpers; the complete original Exchange/Queue source has not been recovered. Custody, authorization, queue accounting and governance use our protocol implementation. Prices are explicit operator-controlled scenarios with a heartbeat, and LABUSD has no real value. HyperCore/BBO integration, production oracle authentication, real-money bridges and production economics remain outside this lab. The 5m allowance limits credited net trader profits per UTC calendar day; it does not guarantee solvency or limit principal withdrawals.

## Live-price and token mechanism recheck

The [Binance experiment report](../binance-simulation-report.json) records 16 oracle publications over an 8-second observation window (11.055 seconds including transactions/cleanup), using live spot quotes. Alice opened/closed BTC long at 82,361.70. Bob opened ETH short at 2,450.99 and closed at 2,451.00; settlement emitted -0.001019 LABUSD PnL and minted 0.0999 PART on a 0.000999 LABUSD emission basis. All closes had successful receipts. Carol claimed 1 LABUSD, unstaked 100 PART and restaked it. The experiment was then reverted, original balances/positions restored, and the Binance polling process exited. These captured receipt hashes are not queryable after revert.

Additional health checks verify token/exchange/staking wiring, staked-token custody against the stake ledger, total token supply coverage, funded collateral reward reserves and coverage of all ten actors' claimable rewards.

The local core game is implemented and tested: margin custody; delayed long/short opens and closes; recovered price-movement haircut/PnL; loss emission with threshold/decay; restricted PART transfer; stake/unstake/claim; fee funding; liquidation; house donations; FIFO and shared 5m/day profit credits; session revocation and delayed governance. PART has no built-in redemption promise, ordinary peer transfers are blocked, and house donations have no LP withdrawal right. Rewards are funded collateral, not a promised APY.

This does not establish complete parity with the original game. Original full Exchange/Queue source, production oracle/BBO/HyperCore, debt-funded collateral, source-site gamification and stock/RWA markets remain outside the implementation. The recovered PnL helper uses price movement and impact parameters; it does not take holding time as an explicit input. Delay/quote windows exist separately. A separate time-decay haircut is not established by this reconstruction.

## Presentation showcase rehearsal

The new [Showcase desk](http://127.0.0.1:4173/#showcase) and Vietnamese [presenter guide](SHOWCASE.md) are ready. A browser-started full tour passed **10 phases with 84 successful local receipts across all 10 actors**, then restored the original state. [Captured rehearsal report](../showcase-rehearsal-report.json). A live Binance continuous desk also completed long/short round trips. Three showcase integration tests cover the full tour, duplicate-start/manual-write protection, Stop/restore and live-price execution. The existing 16 demo, 3 quote-validation and 8 archive tests passed again; the 12 unchanged protocol tests remain passing from the preceding verification, for 42 tests across the suite.

A separate shutdown exercise started automation, stopped the whole service gracefully, verified checkpoint restoration, resumed the saved Anvil state and checked that balances/positions were unchanged. All 36 read-only health checks passed after restart. Showcase report/receipts persist across restart; no running feed is left enabled after completion.

Browser verification covered Start from the UI, changing source/mode selectors, phase/price updates, desktop 1280px and mobile 390px widths (document content width matched viewport), and restored-ready state. Temporary viewport overrides were reset. Screenshots: [desktop](screenshots/showcase-desktop.png), [mobile](screenshots/showcase-mobile.png). The showcase preserves manual account/position state through a checkpoint; native test gas used by the fixed-price heartbeat can continue changing normally after restore.

Full tour stress is explicitly labelled as scenario data, even if the initial market segment uses Binance. Continuous mode remains on its chosen source and fails without a synthetic fallback if Binance is unavailable/stale. The morning follow-up now checks whether a showcase is running before doing any regression work and preserves an active presentation.

## Rust / database / Redis integration QA

Verified 16 October 2026 (Vietnam time). All UI/API traffic now enters Rust Axum on 4173; SQLite WAL stores projections and managed receipts/events, Redis caches exact-identity snapshots, and the Node ABI/transaction engine is private on 4174. Contracts and runtime hashes are unchanged. [Architecture and operation guide](../backend/README.md) · [machine-readable QA report](../backend-verification.json).

**53 tests pass:** 3 Rust database tests, 8 backend integration tests, 16 demo integration tests, 3 showcase tests, 3 Binance validation tests, 12 protocol tests and 8 archive tests. **42 read-only health checks pass.** New coverage includes per-actor cache isolation, 80 concurrent readers, mutation invalidation, same-height external rewind, receipt/history reconciliation, SSE real oracle updates, Redis interruption/reconnection, engine outage with rejection of stale persisted data, repeated-quote gas headroom and re-mined transaction hashes updating their indexed block.

Warm local API measurements (HTTP response + JSON parsing): original full-read Node baseline n=12 p50 **258.18 ms**, p95 **266.52 ms**; Rust/cache n=100 p50 **0.73 ms**, p95 **1.56 ms**. An additional 80 concurrent readers completed in **32.15 ms**; the combined warm test added **zero eth_call / zero snapshot collections**, with one head-read RPC. These are cache-hit/local measurements, not transaction settlement latency or production performance guarantees.

All nine application screens were reviewed. Browser actions deposited 1 LABUSD, opened and closed a new 10 LABUSD / 10× BTC long, and withdrew 1 LABUSD, returning Alice to the original cash balance. The browser-started ten-phase Rust/SSE tour completed with **84 successful receipts across ten actors**, then restored balances, positions and original 29-point histories for each market. Desktop 1280px and mobile 390px views had no horizontal document overflow; the sync banner recovered and final JavaScript error logs were empty. Screenshots: [desktop backend card](screenshots/backend-contracts-desktop.png), [mobile backend card](screenshots/backend-contracts-mobile.png).

Actual owned Redis process shutdown/restart preserved API availability and reconnected. Full-stack graceful shutdown during active automation restored the checkpoint before Anvil stopped. SQLite `PRAGMA quick_check` returned `ok`; restart preserved actor balances, positions, contracts and price history. Cache data is revalidated against the engine/head after restart. Legacy chart observations without hashes are retained, while hash-backed orphan observations and receipts are removed from current projections after a rewind.

QA also fixed an oracle publish failure caused by an exact gas estimate for an unchanged timestamp slot becoming insufficient in the next mined block. Managed transactions now use a 20% + 10,000 gas headroom; stale/paused/unauthorized cases still revert normally. Private signer exports are not cached/indexed; runtime DB/cache credentials remain ignored and owner-only.

## Shared LAN participant mode — 2026-10-16

See [LAN setup](LAN.md) and [machine-readable evidence](../lan-verification.json).

Six shared-gateway integration cases passed with actual signed transactions through `public/wallet.js` using an EIP-1193 test adapter: custody, real Binance delayed open/close, stake/unstake, EIP-712 session orders, role authorization, and governance schedule/index/cancel. Three Rust persistence tests and three Binance validation tests passed. All 42 read-only health checks passed. Normal stop/resume preserved all ten account balances, positions, orders, deployment addresses and queryable external receipts; ordinary resume remembers shared-mode guards.

A real-time worker queue issue caused transient API timeouts during the initial interval-mining run. Fixed by allowing reads between individual oracle/keeper transactions and retaining an active-order set; repeated signed-trade/session checks then passed. macOS keep-awake child shutdown was also fixed and graceful stop/resume reverified.

Nine routes render without horizontal overflow; desktop and 390px screenshots are under `screenshots/shared-lan-*.png`. The actor selector is read-only in shared mode, wallet export is blocked, clock jumps are removed, rollback tours are disabled, and missing-wallet guidance is visible. The in-app browser has no actual wallet extension, so MetaMask approval UI was not tested.

**Outstanding network check:** actual Wi-Fi IP requests time out despite the all-interface listener. Localhost succeeds. macOS Firewall is enabled and the Mac is locked; OS network permission is suspected but not conclusively diagnosed. Another computer's connection is not yet verified. The host must unlock/allow the API and test the LAN URL. No firewall protection was disabled. Binance/keeper were stopped after bounded real-price QA, while the persistent fork remains running.

## Extended QA — 2026-10-16

[Full report](QA-REPORT-2026-10-16.md) and [raw measurements](../qa/results-2026-10-16.json) cover 60 passing functionality tests and 13 qualified stress scenarios, plus mixed read/write load. The previous lifetime-index guard was reproduced at nextOrder=2002 (HTTP 503), replaced with paged catch-up, and verified at nextOrder=5002 (HTTP 200). Cold catch-up of 5,001 order IDs took 15.25 seconds with explicit loading responses and no partial fresh position list. Production demo state was preserved during the software upgrade and all 42 health checks passed. LAN access from another device and real MetaMask UI approvals remain unverified.
