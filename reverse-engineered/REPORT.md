# Papertrade reverse engineering with REA

REA 6.5.0 was used on the existing archived deployment artifacts. It successfully analyzed **19 bytecode carriers**: the selected implementations/runtime for all 18 inventory entries, plus the shared protocol proxy runtime. Raw REA Evidence, exact carrier and decoded-byte digests, function offsets, declared compiler metadata and limitations are retained in [inspection/rea](../inspection/rea/). No global MCP registration or user configuration was changed.

REA's EVM capability is interface/offset/metadata inference through EVMole 0.9.3. It is **not a Solidity decompiler**. The reconstructed code below combines that static evidence with disassembly, explicit read-only local execution traces and differential tests. Original Papertrade Solidity remains unavailable. No bytecode-equivalent recompile, audited replacement, or full protocol reimplementation is claimed.

## Results

| Area | Output | Verification / limits |
|---|---|---|
| PAPER token | [PaperToken.reconstructed.sol](token/PaperToken.reconstructed.sol), [findings](token/TOKEN-RECONSTRUCTION.md) | 40 differential cases compare return/revert bytes, SSTORE writes and event data; initialization nesting remains partial |
| Mint curve | [MintCurve.reconstructed.sol](token/MintCurve.reconstructed.sol), [integer model](token/mint-model.mjs) | Exact integrated finite-loss calculation and floor order for tested normal-range cases; not all extreme integer behavior |
| PnL and impact | [SettlementMath.reconstructed.sol](settlement/SettlementMath.reconstructed.sol), [findings](settlement/FINDINGS.md) | Deadband, raw/adjusted PnL and haircut rounding; 46 total compiled math vectors across mint/impact/PnL match original runtime |
| Queue | [Queue.pseudocode.txt](settlement/Queue.pseudocode.txt) | Five ephemeral trace scenarios establish append, FIFO cash harvest and newest-first debt collateral consumption; full cash/debt settlement remains partial |
| Session manager | [SessionKeyManager.reconstructed.sol](auth/SessionKeyManager.reconstructed.sol), [findings](auth/FINDINGS.md) | Concrete storage/domain/bitmap/registration/revoke harness; signed registration matches three storage writes and event topics |
| Batch executor | [BatchExecutor.reconstructed.sol](auth/BatchExecutor.reconstructed.sol), [recovered ABI](auth/recovered-abi.json) | Exact tuple input and failure-group logic; five local probes. Reconstruction is abstract: event/error recording is intentionally incomplete |
| Price oracle | [PriceOracle.reconstructed.sol](auth/PriceOracle.reconstructed.sol) | Recovered BBO and execution midpoint read path; initializer, ownership, mark/oracle and batch methods omitted |
| Protocol proxy | [ProtocolProxy.reconstructed.sol](admin/ProtocolProxy.reconstructed.sol) | 17 runtime differential vectors match output/reverts and storage writes; constructor is a convenience, not recovered creation code |

All eight reconstructed/helper Solidity files and all 18 input-only interfaces compile with Solidity 0.8.24, optimizer enabled, viaIR. These are locally selected research build settings, not recovered original compiler settings. [Compiler output](build/compilation.json) records source digests and diagnostics.

## Findings that change the earlier inspection

1. **Batch ABI:** `execute((address,bytes,bool,bytes32,bytes32)[])` hashes to `0x251fb27d`. The earlier automated `uint256[]` inference was insufficient. The bool is allowFailure; the two bytes32 values serve as failure-group and item identifiers. Group names are analyst labels. Failed groups skip later matching calls; earlier successes are not rolled back by an allowed failure.
2. **Nonces:** a bitmap enables unordered nonce use. The public counter is a high-water mark. This matters when reproducing relayer queues and concurrent requests.
3. **Minting:** the actual finite-loss calculation integrates the tail curve with multiple integer floors. A marginal rate multiplied by the entire loss is not equivalent. LP drains leave tail progress unchanged. A separate privileged allowance role and staking-only movement gate exist in PAPER.
4. **PnL:** the helper returns uncapped raw loss and margin-clamped adjusted loss as separate words. Favorable prices lose the deadband first. The impact scale is floored before multiplication by profit; combining divisions changes results.
5. **Queue priority:** cash pays oldest global claims, but debt collateral consumes the user's newest claims, preserving older cash-payment priority. Queue nodes pack address and uint48 next/previous links in one word, amount in the next.
6. **Automated types need correction:** library `0x82296364` requires nine calldata words, not five. Library `0x3f4e3626` takes an amount in its third word, not bool. See [annotations](../inspection/rea/annotations.json); original REA output remains unchanged.
7. **Oracle boundary:** the raw BBO method and execution-price validation are separate. Authentic native book data still does not guarantee manipulation resistance.

## Reproduce

Existing Anvil fork required for runtime probes; start `npm run fork` if needed. All new verification scripts use read-only `eth_call` / `debug_traceCall`; state overrides are ephemeral. The earlier broader smoke suite separately uses local-only impersonation and reverts its changes.

```sh
npm ci --ignore-scripts
npm run reconstruct:compile
npm run reconstruct:verify-math
npm run reconstruct:verify-proxy
node reverse-engineered/token/verify-readonly.mjs
node reverse-engineered/token/verify-token-reconstruction.mjs
node reverse-engineered/auth/probe-session.mjs
npm test
```

REA requires Linux x64 for this capability. On this macOS arm64 host, it ran unmodified in an x64 container. The analysis container has network disabled and a read-only workspace mount, with write access only to its results directory. The image supplies procps `ps`, required by REA for child-process ownership inspection. Node is v24.22.0 inside the container. REA package version and dependency lock are under `tools/rea-runtime`; Dockerfile is `tools/rea.Dockerfile`.

```sh
npm ci --prefix tools/rea-runtime --ignore-scripts --omit=optional
docker build --platform linux/amd64 -t papertrade-rea:6.5.0 -f tools/rea.Dockerfile tools
npm run rea:inspect
npm run rea:summarize
npm run report
```

The npm package is pinned to REA 6.5.0. The consulted workflow/source checkout was `morluto/rea` commit `2b5ee72d2627267aa81db5e6dd290696cc2e40cd`. [REA EVM guide](https://github.com/morluto/rea/blob/2b5ee72d2627267aa81db5e6dd290696cc2e40cd/docs/evm-bytecode.md). No Hopper/Ghidra/IDA was installed or required for this EVM interface capability.

## Remaining work before a replacement exchange

- Full high-level Exchange settlement order, side-bucket transitions, fee rounding/allocation, debt-funded winning restoration and exceptional branches.
- Complete PaperStaking implementation, deposit factory/proxy implementation, sweeper/finalize path and native custody behavior.
- Full initializer, owner/admin setter and event equivalence for partial reconstructed contracts.
- Extreme integer, malformed calldata, gas, reentrancy and all-branch behavioral equivalence.
- Live HyperCore oracle/custody integration and production relayer/keeper infrastructure.
- Original source license and source-equivalent compiler reproduction.

These are explicit gaps. The delivered reconstructions are useful for understanding and further testing; the existing bytecode fork remains the authoritative executable reference for the captured deployment.
