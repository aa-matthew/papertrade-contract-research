# Oracle integration contract

`IExecutionOracle.price(market)` returns `(priceWad, observationUnixSeconds)` or reverts. `StreamOracle` consumes Chainlink Data Streams **Crypto Advanced v3**, not the Papertrade/HyperCore oracle.

## External boundary

The immutable trusted verifier implements:

```solidity
verify(bytes payload, bytes feeParameters) external payable returns (bytes verifiedReport);
```

Only verified output is decoded as the static v3 tuple of feedId, validFromTimestamp, observationsTimestamp, nativeFee, linkFee, expiresAt, price, bid, ask. The adapter itself does not implement OCR signature verification; compromising or misconfiguring the verifier compromises prices. A mock verifier in tests is solely for exercising checks around this boundary.

Feeds are configured once per market, constrained to the `0x0003` version prefix. Stream prices may use 8 or 18 decimals. The configured precision is trusted metadata: normalization multiplies by `10^(18-decimals)`. Bounds use normalized WAD, spread uses raw quote units. Verify precision using the actual feed specification; choosing it incorrectly can misprice positions by 10 orders of magnitude.

Both updates and reads require an unpaused adapter and, when configured, an up sequencer with completed recovery grace. Updates reject wrong feed, future observation, invalid validFrom/observation ordering, expired/stale report, nonpositive/inconsistent bid-mid-ask, WAD bounds violation, excessive relative spread, older or conflicting same-second values. Reads recheck age and the **stored report expiry**, so a cached update cannot outlive its validity.

The adapter stores only the latest observation. Re-publishing identical timestamp/value is allowed; a different value with the same timestamp is rejected. Freshness is at most 30 seconds; configure based on feed cadence and operational latency. Orders additionally require observation >= their eligibility time. Multiple orders can share one valid report. Price limits remain mandatory.

## Remaining live integration work

No chain-specific verifier, collateral or feed addresses are guessed. Before opening a remote market, attach evidence for:

- Correct verifier proxy bytecode/authority and its real signature verification; send a genuine signed report through the **deployed adapter**, not just the proxy.
- Exact feed ID, schema and decimals on the target network; wrong-feed and altered-signature rejection.
- Subscription/access permissions for the adapter, fee parameters and native value behavior. Current subscription billing docs use empty fee metadata; legacy fee fields are not a payment quote for our keeper by themselves.
- L2 sequencer uptime feed address and semantics, or explicit absence with tested independent pause monitoring. A zero onchain sequencer disables that health gate; it does not prove availability.
- End-to-end report latency, stale/expiry transitions, recovery grace and RPC/sequencer outage drills.

Separate report publication/execution can increase latency and allows latest-report races. A production atomic update-and-execute router could improve this, but would need its own review; it is not claimed in v0.1. This adapter only handles crypto v3 reports. Stock/RWA schemas, market hours, corporate actions, liquidity and collateral conversion need a different integration.

## Primary references

- [Robinhood connectivity and endpoints](https://docs.robinhood.com/chain/connecting/)
- [Robinhood contract deployment](https://docs.robinhood.com/chain/deploy-smart-contracts/)
- [Chainlink v3 report fields](https://docs.chain.link/data-streams/reference/report-schema-v3)
- [Chainlink EVM verification tutorial and interface](https://docs.chain.link/data-streams/tutorials/evm-onchain-report-verification)
- [Chainlink onchain verification reference](https://docs.chain.link/data-streams/reference/data-streams-api/onchain-verification)

These were reviewed on 2026-10-15. Reconfirm service/network support and addresses at deployment time.
