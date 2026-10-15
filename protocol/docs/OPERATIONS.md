# Operations guide

Run commands from `protocol/`. `MANIFEST` below is your actual file under `deployments/`. Amounts are decimal integer strings. `operate.mjs encode` only emits transaction data; `call` is read-only; `send` requires explicit `--broadcast` and an unlocked local signer or encrypted remote keystore. Set `TX_VALUE_WEI` only when the target payable call requires native value. The script uses signer 0 on local Anvil; use ethers with other signers for multiple traders.

## Inspection and transaction preparation

```sh
node scripts/operate.mjs status MANIFEST
node scripts/operate.mjs call MANIFEST exchange balances '["0xUSER"]'
node scripts/operate.mjs call MANIFEST exchange positions '["1"]'
node scripts/operate.mjs call MANIFEST exchange pendingOrders '["1"]'
node scripts/operate.mjs call MANIFEST oracle price '[1]'
node scripts/operate.mjs encode MANIFEST exchange setOpensPaused '[true]'
```

For broadcasting your own reviewed transaction, replace `encode` with `send` and append `--broadcast`. Check chain ID and deployed runtime hashes against the manifest. Do not put the literal `MANIFEST`/`0xUSER` examples into a live transaction.

## Collateral and trading

1. Approve exchange on the **collateral** contract, then `deposit(rawAmount)` on exchange. For local tests only, call collateral `mint(user,amount)` and mock oracle `set(priceWad,currentTimestamp)`. A remote token's mint is not part of this protocol.
2. Read current market parameters and nonce bitmap. Construct a deadline between estimated request timestamp + delay and that value + executionWindow, leaving room for inclusion. Submit an order with fields:

```json
{
  "user": "0xWALLET",
  "market": 1,
  "positionId": "0",
  "margin": "100000000",
  "leverage": 20,
  "isLong": true,
  "priceLimit": "81000000000000000000000",
  "nonce": "1",
  "deadline": 0
}
```

Replace deadline with an actual Unix-seconds value. Long open is a buy capped at the limit. `positionId = 0` opens; a close references an existing ID, keeps its market/direction, and sets margin/leverage to zero. Close price limit is a sell minimum for a long and a buy maximum for a short. Read `OrderRequested` from the receipt for the ID/eligible time. There is no stop-loss/limit resting-order engine.

3. After eligibility, a keeper publishes a fresh verified price with observation >= eligibleAt and <= deadline/window. Call `execute(orderId)`. Any account can execute, but the price limit, deadline and signature state still apply. Failed execution does not consume an order; retry only while valid, otherwise cancel/resubmit with a new nonce.
4. Close requests require two seconds since opening. `cancel(orderId)` releases an unfilled open's margin; after expiry anyone can cancel. `withdraw(amount,recipient)` can only spend the caller's cash-backed balance. `queued(user)` is not withdrawable collateral.

For sessions, wallet calls `setSession(key,expiry,budget)`; expiry <= 30 days and budget is cumulative margin, not per-order. Sign the exact domain/type in [LOGIC.md](LOGIC.md) with wallet/session; relayer calls `requestBySig(order,signer,signature)`. Chain and exchange address are domain-bound. Revoke with `revokeSession(key)`; accepted session orders then fail execution and can be cancelled by wallet. `invalidateNonces(word,mask)` only prevents new acceptance. Closing authority has no budget charge. Keep private session keys off repositories and limit lifetime/budget.

## Oracle and keepers

Use Chainlink's official API/SDK and credentials to fetch a **signed full report payload** for the configured feed. Never locally fabricate or decode/re-encode a payload before verification. `StreamOracle.update(market,payload,feeParameters)` forwards it to the configured verifier. Subscription deployments commonly use empty fee metadata and no native value; verify the selected service's exact requirements. This project does not ship a production credentialed report-fetch daemon or assume arbitrary API endpoints.

For small setups the keeper cycle is:

1. Read pending order events/state; select eligible unexpired orders and required markets.
2. Fetch/submit valid reports; check resulting observation, feed decimals, bounds and freshness.
3. Execute eligible orders with gas estimates, simulate first, record outcomes and retry with bounded backoff. Report-update and execute are separate transactions; refresh as needed if another keeper advances the latest report. A revert must not cause uncontrolled nonce/fee retries.
4. Check open position events/state and current validated prices; call `liquidate(positionId)` when linear adverse loss plus buffer reaches margin. No bounty is paid by the protocol.
5. With house cash, remaining `dailyPayoutRemaining()` and queued claims, call `harvest(maxEntries)` (1..100), respecting chain gas limits. Partial head fills are normal. With an empty queue, call `pushFees()`; surplus sweep requires no live positions or pending opens.
6. Expire/cancel abandoned orders. Index emitted events durably from deployment block, handle reorgs using canonical receipts/finality, periodically reconcile state against contract getters.

Keeper ordering affects fills and liquidations. Deploy redundant operators with independent RPCs, funded gas wallets, credential rotation and clock synchronization. Sequencer inclusion/confirmation, oracle report delivery and configured delay determine practical latency; this implementation makes no subsecond guarantee.

## Daily payout operations

The net trader profit budget is **$5m nominal collateral per UTC day**, shared by all wallets, markets, direct profitable closes and harvests. Status prints `DAILY_PAYOUT_LIMIT` and `dailyPayoutRemaining`; query historical consumption with `exchange profitPaidByDay '["UTC_DAY_NUMBER"]'`, where day number is Unix seconds divided by 86400, rounded down. Index `ProfitPaid(user,amount,utcDay)` for reconciliation.

At zero remaining allowance, stop profit-harvest retries until the next 00:00 UTC; positions can still close and new profits queue. Cash still has to exist after reset. Keepers should harvest the existing FIFO head first; the contract prevents newer winners bypassing it. Withdrawals of principal/already credited cash do not consume or restore the budget. The contract has no adjustable daily-limit parameter; changing the constant requires a new deployment.

This is not rolling 24 hours; two daily allowances can be used near midnight. It does not cap accrued profit or queue debt, and staking/developer distributions are outside its scope. The separate house surplus cap does not represent the daily allowance. Monitor debt growth and unrealized winning PnL as well as cash payouts.

## PART and staking

A losing settlement mints PART. User approves **staking** as PART spender, then `stake(partAmount)`. Read `pending(user)`; `claim()` sends collateral directly to the wallet. `unstake(partAmount)` returns PART, which remains restricted to staking transfers. Fees sent with no stakers remain parked until a later nonzero reward notification when stake exists. Claims may round down; monitor reserve reconciliation.

LP seeders approve exchange and call `seedLiquidity(amount)`. **This is a donation without a withdrawal claim, shares, interest or redemption.** Do not market it as an LP deposit. Queues are funded by donations/retained losses; an exhausted house cannot guarantee profitable payouts.

## Governance

All owner operations after deployment pass through `ProtocolTimelock`. Use `encode` to produce target calldata. Governor schedules then executes:

```text
schedule(target, value, data, predecessor=0x00..00, salt=uniqueBytes32, delay>=getMinDelay())
execute(target, value, data, predecessor=0x00..00, salt=sameBytes32)
```

`hashOperation`/`getTimestamp` identify readiness. `cancel(operationId)` is available to the canceller role; the governor receives it through OpenZeppelin's proposer assignment. Queue transactions from the actual governor multisig, not the deployment EOA. `operate.mjs encode MANIFEST governance schedule '[...]'` prepares calldata for the multisig; send ETH only when the scheduled operation requires it. `updateDelay` is itself timelocked and enforces a permanent one-day minimum. Monitor delay changes and governance role grants.

`configureMarket` needs no live positions or pending opens on that market. To lower risk while positions remain, pause opens immediately; reduce parameters only after positions settle. Guardian can call `setOpensPaused(true)` directly and oracle `setPaused(true)` directly. Guardian cannot unpause; timelock owner can. `retireMarket` is an irreversible, privileged settlement freeze at a **currently healthy** oracle value; it does not work when no valid price is available. Use it only under an established incident decision process.

## Monitoring and incidents

Monitor: actual custody versus accountedAssets, queue debt/head age, house cash and exposures, cash balances and locked margin, fee reserves, staking reserve and claims, report timestamp/expiry/spread, verifier reverts, pending order age, liquidations due, keeper gas balances, governance operations/roles, collateral freeze/depeg/upgrade events and sequencer health.

On stale/conflicting prices or sequencer faults: pause opens, pause oracle when necessary, stop execution/liquidation keepers, cancel pending opens, retain evidence. Oracle pause intentionally blocks market-priced closes and liquidations too; wallet withdrawals of existing cash still work, subject to collateral behavior. A paused/down oracle cannot provide the price needed for market retirement. Restore the data source, wait recovery grace, then timelock-unpause after validation. This version has no arbitrary emergency settlement-price override.

On cash deficit: pause openings and fee operations externally, inspect token/admin behavior and receipts, reconcile known assets/liabilities. There is no insolvency haircut mechanism or unilateral owner rescue withdrawal. A freeze by the collateral issuer can block withdrawals despite internally correct accounting.

## Build and release operations

Use `npm ci`, `npm run compile`, `npm test`; archive `artifacts/build-info.json`, `artifacts/standard-input.json`, ABI/bytecode and the deployment manifest. Verify source and runtime hashes, record keeper/config versions, and dry-run governance. Runtime changes require a new immutable deployment. Never include credentials in a public artifact or commit.
