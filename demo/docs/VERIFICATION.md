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
