# Robinhood Synthetic Protocol — original v0.1

A standalone Solidity prototype of a collateralized, oracle-settled leveraged trading protocol targeting **Robinhood Chain**. This folder is our implementation; the parent archive and `reverse-engineered/` contain the separate Papertrade investigation. This is not Papertrade's recovered source or a bytecode-equivalent clone.

## Start here

- [Deployment guide](docs/DEPLOYMENT.md): reproducible local deployment, Robinhood configs, preflight, governance handoff and launch.
- [Operations guide](docs/OPERATIONS.md): trading, signatures, reports, liquidations, queues, staking, governance and incidents.
- [Logic and accounting](docs/LOGIC.md): contract relationships, state transitions, units, economics and differences from Papertrade.
- [Oracle integration](docs/ORACLE.md): report verification, decimals, timestamps, sequencer assumptions and deployment evidence still needed.
- [Validation record](docs/VALIDATION.md): checks performed and limits.

## Local quick start

Node.js 20+ and Foundry's `anvil` are required. Run commands inside this folder:

```sh
npm ci
npm run compile
npm test
```

The tests start and stop an isolated Anvil process on an ephemeral loopback port. For an interactive local deployment, start a separate terminal:

```sh
anvil --host 127.0.0.1 --port 8546 --chain-id 31337 --hardfork cancun
```

Then:

```sh
npm run deploy:local
node scripts/operate.mjs status deployments/REPLACE_WITH_MANIFEST.local.json
```

The local deployment uses unrestricted mock collateral and a manually set mock oracle. Both constructors reject nonlocal chain IDs. These mocks are test fixtures, never live assets or price authorities. Local opens are enabled for exploration; token, staking and exchange ownership transfers to a one-day timelock. Use the timelock for subsequent owner changes.

## Contract set

| File | Responsibility |
| --- | --- |
| `src/Exchange.sol` | Custody, margin, delayed orders, session authorization, positions, liquidation, FIFO claims and fees |
| `src/StreamOracle.sol` | External Chainlink verifier, immutable feed binding, quote/time/health validation and WAD normalization |
| `src/Economics.sol` | Winning PnL haircut, losing PnL clamp and integrated loss-mint curve |
| `src/ProtocolToken.sol` | 18-decimal PART; only exchange mints, transfers only through staking |
| `src/ProtocolStaking.sol` | PART stake, accumulator rewards, direct collateral claims |
| `src/Governance.sol` | OpenZeppelin timelock with minimum one-day delay |
| `src/Interfaces.sol` | Narrow protocol interfaces |

Compiler: pinned solc 0.8.30, optimizer 200, via IR, Cancun EVM. Dependencies are locked in `package-lock.json`. Build outputs include ABIs, bytecode, storage layouts, source digests and runtime sizes. This folder has its own package manifest and no dependency on the research tooling.

## Scope and readiness

Implemented: cash-funded synthetic long/short positions; 6-decimal ERC-20 custody; delayed execution; signed wallet/session orders; leverage/exposure limits; loss emissions; nontransferable participation; staking; cash-backed withdrawal; deferred profits; governance and guardian pauses.

Deliberate v0.1 choices: queued profits cannot collateralize positions; seed capital is a **non-redeemable donation**, with no LP shares; no HyperCore integration; no funding payments, order book, stock-token trading, upgradeable proxies, insurance fund or liquidation bounty. A keeper is necessary for timely execution but execution is permissionless.

This is an unaudited prototype. Passing local tests does not establish solvency, economic resistance or live oracle compatibility. Live verifier/feed IDs, feed decimals, collateral behavior, sequencer monitoring and real signed-report verification must be established on Robinhood before launch. Remote configs deliberately contain missing addresses and start paused. No Robinhood deployment is included.

PART has no hard supply cap, sale allocation, admin mint or redemption guarantee. Loss-based emissions can create self-trading incentives; evaluate those economics before accepting capital. Profit claims may remain unpaid indefinitely if house liquidity is exhausted.

Original source files use MIT SPDX identifiers. OpenZeppelin remains subject to its own license.
