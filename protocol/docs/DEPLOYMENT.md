# Deployment guide

## Networks and prerequisites

Verified against [Robinhood network documentation](https://docs.robinhood.com/chain/connecting/) on 2026-10-15:

| Target | Chain ID | Public RPC | Explorer |
| --- | --- | --- | --- |
| Robinhood mainnet | 4663 | https://rpc.mainnet.chain.robinhood.com | https://robinhoodchain.blockscout.com |
| Robinhood testnet | 46630 | https://rpc.testnet.chain.robinhood.com | https://explorer.testnet.chain.robinhood.com |
| Local Anvil | 31337 | http://127.0.0.1:8546 | local JSON-RPC |

ETH pays gas. Public endpoints are rate limited; select an authenticated production provider via `RPC_URL`. See the [official deployment guide](https://docs.robinhood.com/chain/deploy-smart-contracts/). Confirm network parameters again before a future deployment.

Install Node 20+ and Foundry separately. From `protocol/`, run `npm ci`, `npm run compile`, `npm test`. Compile runs the runtime size check; tests choose an ephemeral loopback port and use only a fresh local chain. The build targets Cancun because the pinned OpenZeppelin implementation uses MCOPY. Preflight tests MCOPY using a read-only `eth_call` code override; RPCs without override support fail closed. Select a compatible RPC rather than deleting the check.

## Configuration

Copy `config/robinhood-testnet.json` to an operator config. Fill these fields using verified chain-specific evidence:

- `collateral`: deployed 6-decimal ERC-20 contract. Confirm issuer, bridge, upgrade authorities, freeze/rebase/transfer behavior and code; no symbol-based assumption that a token is official USDC/USDG.
- `verifier`: the correct Data Streams verifier proxy, including its billing/access arrangement for our oracle caller. No address is supplied by this project.
- `sequencer`: supported Chainlink uptime feed, or the zero address with `sequencerRiskAcknowledged: true` when unavailable. In that case deploy external sequencer monitoring that pauses openings and the oracle on faults. Do not mistake Robinhood's sequencer WebSocket endpoint for an onchain uptime feed.
- `guardian`, `developer`, `governor`: distinct operational addresses where appropriate; governor should be an operationally tested multisig. Guardian can pause openings/oracle and irreversibly retire a market at a current verified price. It cannot withdraw user funds.
- `timelockDelay`: at least 86400 seconds; governor is sole proposer, canceller and executor. Timelock is its own administrator.
- Each `feed`: exact v3 feed ID, **confirmed 8 or 18 price decimals**, maximum age (1–30 sec), spread limit (0–500 bps), WAD price bounds. Market feed configuration is permanent; changes require a new market ID/new deployment.
- Each `risk`: margin and side caps in raw collateral units; impact fields in WAD. Example values are simulation defaults, not calibrated launch parameters. Start with `enabled: false` and low exposure.

Remote `unpauseLocal` must be false. The collateral/verifier bytecode and collateral decimals are checked, but bytecode existence does not prove legitimacy. Remote deployments never use mocks and remain paused. Subscription billing commonly uses `feeParameters = 0x`, value 0; verify this with the exact deployed verifier.

## Plan and broadcast

```sh
node scripts/deploy.mjs --config config/your-testnet.json
```

This performs read-only preflight and prints the plan. Blank templates intentionally fail. `RPC_URL` can override the config endpoint. Avoid putting secret-bearing RPC URLs in committed configs or deployment manifests.

For an actual deployment, use a funded encrypted Ethereum JSON keystore. Supply its path/password through your secret manager or a protected interactive environment; never commit keys/passwords:

```sh
export KEYSTORE_PATH=/absolute/path/to/encrypted-wallet.json
# Set KEYSTORE_PASSWORD securely in this process environment.
node scripts/deploy.mjs --config config/your-testnet.json --broadcast
```

The deployer must have ETH for the entire transaction sequence. The script deploys token → staking → oracle → exchange, wires privileged mint/reward roles once, configures markets/feeds, deploys governance and transfers ownership to the timelock. It does not seed liquidity, fund user accounts or enable remote trading. Local mode uses an unlocked Anvil account and a test oracle; no test private key is embedded.

Deployment consists of separate transactions, not one atomic transaction. A failure may leave partially initialized contracts. Use explorer receipts and the deployer nonce history to recover addresses, keep them paused and either finish the verified sequence manually or redeploy. Do not blindly rerun and treat old deployments as active. The final manifest is written only after successful handoff.

The manifest records deployment receipts, contract addresses, runtime code hashes, compiler, source digests and full nonsecret config. Preserve it with `artifacts/build-info.json`, compiled ABI/metadata and lockfile. Compare onchain runtime hashes before operations. Verify source on the selected explorer using the exact standard JSON input and compiler settings. Libraries are inlined; there are no proxies.

## Launch sequence

1. Complete external review and live report verification on testnet. Confirm accepted/rejected timestamps, decimals, feed binding, access restrictions, outage/recovery behavior and current chain gas limits. Local mock verifier tests do not establish real signature verification.
2. Verify all immutable relationships, timelock roles, owners, guardian and developer destinations using `operate.mjs call`. Rehearse schedule/execute/cancel and key rotation.
3. Run keepers and indexers with report credentials, ETH and alerting. Index from the manifest deployment blocks. Rehearse cancellations, failed order expiry, queue harvesting and oracle outage response.
4. Schedule/execute `StreamOracle.setPaused(false)` through governance; publish a real verified report and inspect `price(1)`. When there is no sequencer feed, test the external monitor first.
5. Donate reviewed seed capital using `seedLiquidity(amount)` after approval. **No LP redemption exists.** Capital seeding is not automatic and does not affect the loss-emission tracker.
6. Schedule/execute market risk configuration with `enabled: true` (only possible without existing positions/pending opens), then `Exchange.setOpensPaused(false)`. Keep conservative margin, leverage and per-side notional limits.
7. Execute a small end-to-end deposit/open/close/withdraw/stake/claim cycle; reconcile cash and all event-derived state. Increase caps only after observing performance and reviewing economic manipulation.

Repeat the process for mainnet using its own verified dependencies and feed IDs. The existing templates are not mainnet launch approval.

## Upgrade and migration

Core contracts have no upgrade function. Guardian pause is immediate; unpause and risk/role changes are timelocked. For a new version, pause new openings, continue closes/cancellations/claims, settle or retire markets using valid prices, drain cash through each user's ordinary withdrawal, and deploy a new set. Queued promises must be handled explicitly; they cannot be silently migrated or confiscated. No emergency owner sweep of user custody exists.
