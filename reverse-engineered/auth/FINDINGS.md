# Auth, batching and price adapter reconstruction

These are analyst reconstructions of the archived implementation runtimes. They are **not recovered original Solidity**, not deployment ready, and do not establish interface completeness. Byte offsets below are hexadecimal offsets in `upstream/contracts/<name>/disassembly.txt` / `implementation-runtime.hex`, excluding the proxy. REA-generated evidence is separately maintained under `inspection/rea`:

- BatchExecutor: `ev_611fd9fc8577dd59d5cca7cfacb2a2faa39fa9656631cf68919d5f8446c624e5`
- PriceOracle: `ev_fdbc1a97399e9b1e71d02321da7a3e8cc90eea6300623e262ef703df6d31b71b`
- SessionKeyManager: `ev_cc2b4bbb21daa3103e0c9ed93c1736557780e473fca607845452e01935ef9063`

These IDs establish REA interface inference/provenance, not control-flow decompilation; the control-flow findings here additionally use direct archived disassembly and read-only local EVM execution.

## Questions and results

### Batch ABI — answered

Recovered signature `execute((address,bytes,bool,bytes32,bytes32)[])` hashes exactly to `0x251fb27d`. It decodes and re-encodes archived successful transaction `0xb733b1abf4f2aaaff974b46ae97563f5e66996967e9080c53023427478d63ba5` byte for byte. This corrects the old loose `uint256` decoding in the archive report. Parameter names are analyst labels:

| Tuple offset | Type | Inferred meaning | Evidence |
|---|---|---|---|
| 0x00 | address | target | decoder 0x0a4f verifies 160-bit canonical form |
| 0x20 | bytes | call data | dynamic slice decoder 0x0a63 |
| 0x40 | bool | allowFailure | strict boolean decoder 0x0a95; false failure reverts at 0x06f0 |
| 0x60 | bytes32 | failureGroup | 0x055c loads it; 0x080f calls list search at 0x0b08 |
| 0x80 | bytes32 | itemId | event data read at 0x0648, 0x06b5, 0x0788, 0x0803 |

A nonzero group is **forward failure suppression**, not rollback of the group: an allowed failure records its group ID in memory; later calls in that same group are skipped before selector validation. Prior successful calls remain effective. A zero group never suppresses later calls. `allowFailure=false` instead reverts the full batch, including earlier successful writes. Group memory is per invocation; no persistent failed-group mapping is touched.

The loop hashes complete calldata at 0x0491–0x04a7 for batch correlation. Caller allowlist is `mapping(address=>bool)` in slot 4, tested at 0x0466–0x047a. Authorization rejects even an empty batch. Actual external execution is ordinary zero-value CALL at 0x05e4, not DELEGATECALL. No arbitrary target/selector forwarding is possible through the normal path: validation 0x0bf8–0x0ce4 checks both target identity and selector.

| Allowed target | Selector set | Interpretation |
|---|---|---|
| exchange | 0xec6783f0, 0x2792e706, 0x8d09f23f | Only three explicit exchange methods |
| sessionKeyManager | 0x5f76a1d6 | registerSessionKeyBySig |
| paperStaking | 0x83115825, 0xfa2871b5, 0x9c96d4a1, 0xf0355460 | Only four explicit staking methods |

Constants in this table account for compiler-shortened PUSH4 values plus SHL, rather than copying PUSH literals blindly.

### Batch execution probes — answered on local archived bytecode

`node reverse-engineered/auth/probe.mjs` uses **only eth_call and debug_traceCall**, with a loopback-only endpoint. No transactions, impersonation RPC, fixture changes or persistent state writes. `probes.json` retains call vectors, return/error data, implementation PCs and external-call sites. The archived transaction sender is supplied as `from` to exercise existing relayer authorization.

Five probes passed their expected behavior: unauthorized empty batch reverts `0x17fb2066`; authorized empty batch succeeds; blocked target/selector with allowFailure=true succeeds as a batch; repeating the same nonzero failed group enters skip PC 0x07bb exactly once and enters validator PC 0x0b3c only once; blocked target/selector with allowFailure=false reverts `0x651ab1b3` with index and reason bytes. No target CALL occurs for the blocked selector examples.

### Session behavior — partially answered

- `sessionKeys(user,key)` (0x96ade1f9 -> 0x03a2) loads a packed word, returning low 64-bit expiry and 160-bit fee address shifted by 64. This manager has no per-key market list, trade-size cap, leverage cap or withdrawal permission bitmap in these paths. Application-method restriction is additionally enforced by the batch allowlist and exchange method logic; do not describe the key as having arbitrary configurable scopes.
- `0x7f608253` (entry 0x04c6) takes `(address,bytes32,uint8,bytes32,bytes32)` in ABI-compatible interpretation. It derives an EIP-712 digest, recovers key, looks up that user's session record and rejects missing/expired key (0x0502–0x0565). Original name unknown. No nonce is consumed here (view path).
- `0xb002b9fa` (entry 0x0309) takes `(address,uint256,uint64)` ABI-compatible input, requires `authorizedCaller` (slot 3), checks deadline and consumes a bitmap nonce (0x032c–0x0369). Original name unknown.
- Nonces are unordered bitmap values: word `nonce >> 8`, mask `1 << (nonce & 255)`, nested mapping at slot 6. Used bit rejects; bit is ORed into storage (0x0cbc–0x0d07). `nonces(user)` at slot 5 is updated to `nonce+1` only when the used nonce is at least its current value (0x0d08–0x0d34). It is a high-water mark, **not a requirement to submit exactly the next nonce**.
- Registration at 0x0778 requires `authorizedSubmitters[msg.sender]` in slot 7 (0x07eb–0x0800), nonzero key (0x0801–0x0809), deadline (0x080a–0x0810), nonce consumption (0x0811), and recovered nonzero signer equal to user (0x0886–0x0898), then stores expiry and fee address (0x08da–0x090d). Full registration/init parameter semantics and every error/event name remain open.
- Revocation 0x042a–0x0489 deletes only `sessions[msg.sender][key]`; no relayer needed.
- ECDSA recovery 0x0d62–0x0ddd accepts v=27/28, rejects high-s above secp256k1 half-order by returning address(0), and uses ecrecover precompile. EIP-712 hashing uses CHAINID at 0x0c70 and 0x1901 prefix at 0x0c7f. This does not by itself prove all intended action separation; calling contracts must supply the correct struct hash.

### Oracle adapter — execution-price path answered, full batch read unresolved

Additional recovered signature `getExecutionPrice(uint32)` hashes to `0xc0182669`, entry 0x019c. BBO read helper 0x08ce submits `abi.encode(uint32 asset)` by STATICCALL to address 0x080e (0x08f1–0x08f5), requires success and at least 64 return bytes and decodes canonical uint64 bid/ask (0x0904–0x092e). Direct `getBBO(uint32)` does **not** apply the midpoint availability/crossing checks; these belong to the execution-price method.

Execution price rejects bid=0 or ask=0 (0x01cf–0x01e0, 0x02bd), bid>ask (0x01e1–0x01e9), then adds and right-shifts one bit to calculate a floor midpoint (0x01ea–0x01f6). It also checks result nonzero. Equal nonzero bid/ask is accepted. There is no timestamp input, staleness comparison, confidence interval, TWAP comparison or cross-source deviation path in this method. Native precompile state is trusted. This is an observation about this adapter, not proof that quotes are economically unmanipulable.

Mark/oracle helper paths call 0x0806 / 0x0807. Additional scalar 0x766cd255 and array method 0xa7f06462 remain unnamed here. No inference of full oracle-interface completeness.

## Files and reconstruction limits

- `recovered-abi.json`: recovered execute input ABI plus BBO/execution price input and inferred outputs.
- `BatchExecutor.reconstructed.sol`: implementation-style core loop and target/selector policy. Aggregate events, init, ownership, exact error names omitted.
- `PriceOracle.reconstructed.sol`: implementation-style BBO and midpoint path. Governance and other oracle views omitted.
- `SessionKeyManager.reconstructed.sol`: concrete behavioral harness with exact slots 0–7, registration, bitmap consumption, expiry verification, revocation and EIP-712 recovery. Unknown public method names are exposed by observed selectors through fallback. Harness constructor replaces original proxy initializer deliberately.
- `probe.mjs`, `probes.json`: reproducible read-only probes and trace observations.

All three Solidity files compile with solc 0.8.24 without imports; local compile output is `compilation.json`. Session manager now preserves the recovered slots, packed record updates and register/revoke event topics. Batch/oracle remain partial and do not preserve their complete storage/event/initialization behavior. None is a complete deployed-bytecode replacement.

### Session harness differential validation — one full registration path answered

`probe-session.mjs` compiles the harness and compares archived implementation execution with a per-call runtime override, using **debug_traceCall only**. Both use the same fork storage, input, from address and signed EIP-712 message. Neither deploys nor persists a transaction. `session-differential.json` records three exact matching SSTORE slot/value pairs (nonce bitmap, nonce high-water mark, packed session record), successful empty return, and identical LOG3 topics. The signature uses `String`, version `1`, chain 31337 and Exchange as verifyingContract; this confirms the manager deliberately signs under its `authorizedCaller` address, not the SessionKeyManager proxy itself. Embedded constants at 0x0e5f / 0x0dff are exactly keccak256("String") / keccak256("1"). DomainSeparatorV4 recomputes current chain ID and authorizedCaller; historical DOMAIN_SEPARATOR is stored separately at slot 1.

`session-storage-trace.json` independently verifies session nested mapping base slot 4 by matching the archived getter SLOAD against candidate slots 0–7 for explicit user/key inputs. The recovered layout is init flags slot 0, cached separator slot 1, owner slot 2, authorizedCaller slot 3, sessionKeys slot 4, nonces slot 5, nonce bitmap slot 6, authorizedSubmitters slot 7. Constructor/governance event differences, omitted typehash getters, unknown public names, original initializer guards, EIP-1271 support (not found in inspected recovery path), and broader adversarial differential coverage remain gaps. Matching this one path is not whole-contract equivalence.
