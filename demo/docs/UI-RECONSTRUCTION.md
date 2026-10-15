# UI reverse engineering

Inspected the live canonical frontend at https://exchange.papertrade.xyz/trade/btc and its House and Paper pages on 2026-10-16 (Vietnam time), alongside the frontend asset archive under `upstream/frontend/assets/`.

Observed trade structure: cream/paper background, dark thin chart line, large chart canvas, market selector and stats above it, narrow order panel on the right, expandable account equity, long/short selector, margin controls, leverage input/slider, order value, bust price, primary trade action, and bottom Positions/History/Leaderboard/Status navigation. Main navigation exposes Trade, Portfolio, House, Paper and Leaderboard, with Deposit/Withdraw/Connect.

The lab recreates those workflows with original HTML/CSS/JavaScript and new Robinpaper labeling. It adds Actors, Operations and Contracts for local testing. Wallet Connect is replaced by ten explicit local actor identities; no real wallet connection or source-site account was used. Every displayed account value comes from the local contracts. House adds a shock table, liquidation trigger map and actual FIFO claim placement. Open PnL is labeled an estimate; it uses the matching impact curve and may differ from exact integer settlement by rounding.

The chart is an SVG of recorded local oracle publication prices. It is not the original chart engine, a replay of Hyperliquid history, or a claim of live price discovery. OI and daily payout metrics are actual lab state. We do not fabricate source volume, 24h returns or a lifetime leaderboard. The leaderboard is explicitly ranked by estimated current open PnL.

Source frontend modules useful for inspection: `trade._coin-Ct4LDCtO.js`, `staking-CTLKBPeX.js`, `wire-d4-U_uLp.js`, funding-route and account modules. Archived module hashes remain covered by the repository's existing integrity tests. No upstream frontend bundle is executed in the lab, so it cannot accidentally submit to the production relayer.
