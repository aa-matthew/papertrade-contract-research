# Functional coverage and honest boundaries

| Function / workflow | UI | Onchain behavior |
| --- | --- | --- |
| BTC/ETH long and short | Trade | Reserve cash, delayed signed/direct request, future observation, price limit, capped exposure |
| Close / close all | Positions | Individual signed requests + keeper executions; margin settlement, haircut and fee |
| Pending orders / cancel / execute | Orders; Operations | Nonce consumption, reserve release, expiry and signature guards |
| Deposit / withdraw | Header dialogs | ERC-20 approve/deposit and wallet-owned cash withdrawal |
| Test collateral | Portfolio → Treasury faucet | Explicit Treasury actor mints local LABUSD only |
| Session authorize / revoke | Portfolio | Budget/expiry/version checks on exchange |
| Session signed trade | Actor 09 → Trade | Actual EIP-712 signature from seeded session key for Alice |
| Liquidation | Positions; Operations | Permissionless hard bust; full-margin loss, recovered loss mint |
| PART stake / unstake / claim | Paper | Restricted token transfers; funded accumulator; wallet collateral claim |
| House donation | House | Non-redeemable `seedLiquidity` |
| FIFO payouts / daily cap | House | Direct closes + harvest share 5m/day; no newer claim bypass |
| Fee push / surplus | House | Queue/subordination and no-position surplus conditions |
| OI, marked risk, liquidation map | House | OI from getters; estimates derived from actual open positions |
| Presentation automation | Showcase | One-click ten-phase tour or continuous trading desk, actor isolation, stop/restore, captured receipts and presenter insights |
| Live Binance experiment | `npm run simulate:binance --prefix demo -- 8` | Fresh spot quotes → actual oracle publications → long/short fills and closes; bounded run, feed off and state restored |
| Oracle publish / pause | Operations | Role-restricted local publisher; guardian pause, timelocked unpause |
| Global opens pause | Operations | Guardian immediate pause; owner unpause via timelock |
| Permanent market retirement | Operations | Capture healthy price; disable opens; frozen-price exits |
| Governance schedule / execute / cancel | Operations | Actual one-day timelock; no ownership impersonation |
| Every public ABI method | Contracts console | Read/write calls with selected actor; normal access checks remain |
| Risk configuration / roles / cap / ERC-20 approvals / nonce masks | Contracts console + governance | Complete deployed ABI, JSON parameters; owner methods must be scheduled |
| Wallet export | Actors / footer | Ten local dev keys, same-origin download; no public upload |
| Receipts and events | History / Operations | Actual local transaction hash, status, block, gas and emitted events |
| Pause/stale scenarios, time changes | Operations | Explicit local fixture controls; not production privileges |

Visual parity is workflow-oriented, not a pixel-identical redistribution of the original bundle. The lab has no production relayer, HyperCore precompile/custody, cross-chain bridge, original deposit proxies, real token funding, credentialed Chainlink Data Streams subscription, source-site login, social sharing or original historical chart/indexer backend. Source debt-funded collateral trading is deliberately absent from our v0.1; queued profits cannot fund new positions. The leaderboard uses current estimated PnL, not fabricated historical performance. Stock/RWA schemas are not implemented.

The recovered Solidity helpers are used directly for PnL and emissions; the surrounding full protocol is our implementation. The original unverified Papertrade contract set remains available as archived runtime and partial reconstructions, not a claimed full-source port. This distinction is visible on the Contracts page.
