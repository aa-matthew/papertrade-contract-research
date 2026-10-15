# Validation record

Local verification on 2026-10-15, Node.js on macOS, Anvil Cancun, pinned solc 0.8.30 with optimizer 200 and via IR.

## Checks

- `npm test` in this folder compiles the complete source/dependency set, enforces the 24,576-byte deployed runtime limit, then runs 11 isolated integration tests on a fresh Anvil chain.
- Tests cover exact deposit/withdraw accounting, delayed report eligibility, slippage limits, nonce replay/cancellation, liquidation and emissions, restricted token movement, staking and collateral claims, cash-backed and unfunded profits, FIFO partial/full queue harvesting, fee reserves, signed-session budget/revocation, exposure caps, pause/retired-market exits, oracle feed/time/spread/proof failures, decimal normalization, cached expiry, sequencer recovery, timelock delay and its permanent minimum, missing remote configuration and integrated mint-curve integer floors.
- Cash custody equals the sum of balances, locked margin, house cash and reserved fees at settlement/cancellation checkpoints in the tests. This is scenario coverage, not a formal invariant proof.
- `npm run deploy:local` was executed against a separate fresh Anvil on port 8546. Wiring, market configuration and ownership handoff completed. `operate.mjs status` reported the timelock owner and a true cash invariant; unsigned pause calldata generation was checked.
- Parent research archive's 8 existing integrity tests also pass. Those tests do not establish correctness of this new protocol; they preserve the evidence archive.

The latest recorded runtime sizes are in ignored `artifacts/build-info.json`; regenerate with compile rather than relying on numbers copied into prose. Exchange runtime is approximately 22.8 KB, below EIP-170.

## Limits

No Robinhood transactions were sent. No genuine Chainlink signed report has been verified through a Robinhood deployment. Mock verifier rejection tests exercise adapter boundaries, not OCR cryptography. Remote template preflight intentionally fails until operator-supplied addresses/feed IDs are completed.

No economic simulation, multi-keeper load/finality test, formal verification, broad adversarial fuzzing or independent audit has been completed. No claim of original Papertrade source equivalence is made. Remaining production work includes collateral/oracle review, emission/self-trade and staking-timing analysis, execution/keeper latency and ordering, sequencer downtime drills, indexing/reorg recovery, governance key management, and capital/queue stress testing.
