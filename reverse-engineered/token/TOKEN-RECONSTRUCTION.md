# PAPER and tokenomics reconstruction

Status: agent reconstruction using archived runtime/disassembly, with read-only Anvil execution. This is not published Solidity, a REA Solidity decompilation, or bytecode equivalence. REA corroborates selector/interface candidates through `inspection/rea/PaperToken.stdout.json` (Evidence `ev_b11d999aac9e634e90e396902bcd4857c1484ba3540b8be7eea077a4d9d3019a`) and `inspection/rea/PaperTokenomics.stdout.json` (Evidence `ev_cb05b96a9a3eb6229d9e2ebedba473a1341a201a3b4a87f8d99413dd126f7997`). The deeper semantics below are agent disassembly/trace analysis, not claims supplied by REA. PC offsets below refer to implementation runtime (or the expressly named library), never proxy runtime. Signature names remain candidates unless independently bound to calldata semantics.

## Deliverables and reproducibility

- `PaperToken.reconstructed.sol`: compilable behavioral token reconstruction with the recovered slot layout, raw error selectors, events, privileged allowance bypass, strict staking transfers, mint/burn and authority setters. Unknown selector names are retained through fallback. Simple initializer branch is reproduced; nested/failed initializer behavior remains partial.
- `verify-token-reconstruction.mjs` / `token-differential.json`: 40 differential cases comparing archived token runtime with compiled reconstruction using ephemeral `stateOverrides`. Compares return/revert bytes, every SSTORE and event topics/data; includes successful mint, burn, staking pulls, finite/max allowances, setters, zero recipients and simple initialization. No chain transactions or persistent state changes. The script compiles token independently with solc0.8.24.
- `MintCurve.reconstructed.sol`: readable integrated mint curve with its exact observed rounding order; expressly bounded to sensible signed inputs.
- `mint-model.mjs`: independently executable integer model.
- `verify-readonly.mjs`: local-only verification using `eth_call`, `eth_getStorageAt` and `debug_traceCall`; sends no transactions, uses no impersonation or state setters.
- `verification.json`: all 26 checks passing, plus raw slot values and transient SSTORE/CALL/LOG evidence. Repeat with `node reverse-engineered/token/verify-readonly.mjs`.
- `library-trace.json`: full opcode trace of the tail branch, captured through `debug_traceCall`.

The fork can change between reads and is not a pinned historical snapshot. The verification establishes the exercised behavior of archived contracts in the fork state, not every possible input.

## PaperToken storage recovered from runtime

| Slot | Meaning | Main evidence PC |
|---|---|---|
| 0 | initialization version byte and initializing byte | `0x04fd`, `0x078e`, `0x05f9` |
| 1 | name, Solidity dynamic string storage | initializer `0x0531..0x0569` |
| 2 | symbol, Solidity dynamic string storage | `0x0579..0x05b1` |
| 3 low 160 bits | owner | owner getter `0x07af`; owner setters `0x0115`, `0x0181` |
| 4 low 160 bits | minter | getter `0x0a08`; mint caller check `0x0829..0x0840` |
| 5 low 160 bits | privileged allowance spender; public unnamed getter `0x12bbf044` | getter `0x0972`, allowance `0x0c20`, transferFrom `0x08dd` |
| 6 | total supply | `0x0954`, mint `0x085c..0x0864`, burn `0x03a7..0x03af` |
| 7 | mapping(address => uint256) balances | `0x07fd..0x0807` |
| 8 | mapping(address => mapping(address => uint256)) allowances | `0x08f5..0x093c`, `0x09ba..0x09d7` |
| 9 low 160 bits | stakingContract | getter `0x01c9`, setter `0x02c2..0x0309` |

The slot5 address equals slot9 in captured state (PaperStaking). Do not rename slot5 to Exchange: that earlier tempting inference is contradicted by the actual storage. Its setter is selector `0xd311b1a9`, gated by owner (`0x0225..0x026c`). No original source name established.

Owner can set minter (`0xfca3b5aa`), staking (`0x9dd373b9`), slot5 spender (`0xd311b1a9`), and transfer ownership (`0xf2fde38b`). No nonzero-address checks are evident in these setter paths. Mint and burn both require caller == slot4 minter. Burn debits an arbitrary supplied account, checks balance and reduces supply. Mint credits the supplied account and supply with checked arithmetic. These paths do not route through the transfer gate.

### Reconstructed transfer/allowance pseudocode

```solidity
function allowance(address holder, address spender) returns (uint256) {
    if (spender == privilegedSpender_slot5) return type(uint256).max;
    return allowances_slot8[holder][spender];
}
function transferFrom(address from, address to, uint256 amount) {
    if (msg.sender != privilegedSpender_slot5) {
        require(allowances_slot8[from][msg.sender] >= amount);
        allowances_slot8[from][msg.sender] -= amount;
    }
    restrictedTransfer(from, to, amount);
    return true;
}
function restrictedTransfer(address from, address to, uint256 amount) {
    require(stakingContract_slot9 != address(0));
    require(msg.sender == stakingContract_slot9);
    require(from == stakingContract_slot9 || to == stakingContract_slot9);
    require(balances_slot7[from] >= amount);
    balances_slot7[from] -= amount;
    balances_slot7[to] += amount;
    emit Transfer(from, to, amount);
}
```

The gate at `0x0c5b..0x0d31` checks caller AND an endpoint. A user's direct transfer into staking is blocked, even for amount zero. Staking may transfer its own tokens out or pull tokens in through transferFrom. Staking cannot transfer directly from one arbitrary user to another. The separate slot5 role bypasses allowances, not this transfer gate; its effect happens to overlap staking in captured state. Unlike many ERC20 implementations, the normal transferFrom path decrements even a stored max allowance (no max-value shortcut in `0x08f5..0x093c`). Direct mint/burn and transfer zero-address behavior must not be assumed to match OpenZeppelin defaults.

## PaperTokenomics storage and authority

| Slot | Meaning | Getter selector / entry PC |
|---|---|---|
| 0 bits 0..7 / 8..15 | initialization flags | initializer `0x0438` |
| 0 bits 16..175 | owner | `0x8da5cb5b` / `0x03a9` |
| 1 low160 | exchange, sole accounting-hook caller | `0xd2f7265a` / `0x02bf` |
| 2 low160 | paperToken | `0x98255e15` / `0x0381` |
| 3 | signed trackedLpUsd | `0x8cf554a7` / `0x03d4` |
| 4 | unsigned persistent tailProgressUsd | `0xdc5682d2` / `0x0284` |
| 5 | flat-region threshold | `0xe9ed73e9` and alias `0x3886cade` / `0x01f7` |
| 6 | surplus threshold/cap | unnamed `0xc16017ca` / `0x0340` |
| 7 | flatRate, WAD | `0x1c3972ba` / `0x0579` |
| 8 | tailDecayScaleUsd, WAD | `0xcbb451da` / `0x02e7` |

The unnamed getter `0xae745703` at `0x035e` calls `0x09b1` and returns `max(trackedLpUsd - slot6, 0)`, using signed comparison/subtraction. This is a computed surplus getter, not another storage field.

Owner gates `setMintParams` (`0x12baae3b` / `0x0597`), setPaperToken (`0xe6ee2285` / `0x0215`) and transferOwnership. `setMintParams` updates slots5,6,7,8 and does not reset slots3/4. Initialization literals decode to 2,000,000 USD flat threshold, 5,000,000 USD surplus cap, 100 PAPER/USD rate and 120,000,000 USD decay scale, all WAD. Owner lives in an unusual packed slot0, unlike PaperToken's slot3.

### The mint curve is a linked library, not merely a getter

Both active loss hooks DELEGATECALL `0xe991817199363046da0a28da6fbad0284e4aa492`, selector `0x7aac24ba`, with six words:

```
(signed lpBeforeCredit, H, eligibleLossBasis, flatThreshold, flatRate, S)
=> (mintedPaper, incrementalTailBasis)
```

The library reads no storage, makes no external calls and returns two words (`0x0024..0x0057`). Library implementation body is `0x00c6..0x0212`. Let W = 1e18:

```
end = lpBeforeCredit + basis
flatBasis = lpBeforeCredit < threshold
    ? min(basis, threshold - lpBeforeCredit) : 0
tailBasis = basis - flatBasis
mintFlat = floor(flatBasis * rate / W)
q0 = floor(S * W / (S + H))
q1 = floor(S * W / (S + H + tailBasis))
effectiveRate = floor(floor(rate * q0 / W) * q1 / W)
mintTail = floor(effectiveRate * tailBasis / W)
return (mintFlat + mintTail, tailBasis)
```

For zero basis, return `(0,0)`. If tailBasis is zero, the divisions involving S are skipped. Critical rounding PCs: ratios at `0x018a`, `0x0190`; rate products/divisions `0x0196..0x019e`; final basis multiplication/division `0x019f..0x01a4`. Arithmetic helpers detect unsigned multiplication overflow (`0x0088`), signed subtraction overflow (`0x005c`), unsigned addition overflow (`0x00b9`) and division by zero (`0x009b`); panic errors are `0x11` and `0x12`. The Solidity reconstruction adds an explicit `basis <= int256.max` bound; raw runtime behavior beyond that bound has not been reconstructed exhaustively.

The finite-loss formula is an integral of the squared marginal tail rate. It differs from multiplying a loss by the current marginal rate. Example proven against library: lp=$3m, H=$20m, loss=$100 => `7346933527700541429700` PAPER base units, tail increment `100000000000000000000`.

The hooks increment slot4 by library tailBasis. The cap-drain hook reduces slot3 without reducing slot4. Thus negative tracked LP is representable; tail progress does not rewind. After a drain takes LP below the flat threshold, newly eligible losses can receive the flat rate again while the old tail ratchet persists. Verify this nuance before modeling token supply from aggregate losses alone.

### Active accounting hooks: ABI-safe neutral names

Original names and full parameter semantics are unknown. Confirmed layouts:

- `0x0efdf838(address,uint256,bool,uint256,uint256)` dispatch `0x0667`, body `0x07b7`. It requires Exchange caller (`0x0690..0x06a1`). The bool is ABI validated. The fifth word is checked against the second. Slot3 receives an upward credit; library receives the pre-credit LP and fourth word as mint basis; mint is `PaperToken.mint(user, amount)` when amount and token address are nonzero. Emits a LOG3 event, data length 192, at `0x0889`.
- `0xed722c96(address,uint256,uint256,uint256)` dispatch `0x01a5`, body `0x0a45`. Exchange-only. Second word is debited from signed slot3 first (`0x0c32..0x0c41`); fourth word credits LP, third word is mint basis. Library receives LP after debit and before credit. Emits LOG2 at `0x0b1a`. The trace records raw argument/state transitions so names need not be guessed.
- `0xc218c676(uint256)` dispatch `0x0305`, body `0x09d1`. Exchange-only cap drain. Zero is a no-op. Nonzero amount must not exceed computed surplus; then slot3 decreases by that amount (`0x0a15..0x0a19`), slot4 is unchanged, and a 96-byte LOG1 is emitted. Excess reverts `0xe247b81f`.

The trace verification deliberately uses synthetic inputs to isolate accounting; it does not claim these combinations are normal Exchange settlement flows. Market-level construction of these arguments remains the Exchange reconstruction's job.

### Redemption is disabled, definitively for this runtime

`redeem(uint256)` selector `0xdb006a75` enters `0x02a0`; `quoteRedemption(uint256)` selector `0xfe16eae8` enters `0x0106`. Both validate nonpayable calldata length and then unconditionally revert custom error `0x32aa90b0`. There is no token burn, USDC transfer, access-dependent successful branch or amount-dependent successful branch. This is stronger evidence than prior probes with absent arguments. Local verification supplies 0, 1 and 100e18 to each and obtains that exact error.

Legacy selector `0x7c7df7b4` validates a seven-word length and an address / uint64 / uint8 at its checked offsets, then also unconditionally reverts the same error (`0x03f2..0x0437`). Do not infer supported redemption from these retained ABI selectors.

## Unresolved boundaries

Original event names/error names, exact original hook names, all pathological integer inputs, full mint-parameter validation reconstruction, proxy initializer edge cases, all zero-address behavior, historic supply reconciliation and economic safety remain unproven. The finite library quote, key storage and authorization, restricted transfer gate, cap drain and disabled redemption are materially reconstructed; this is not a complete deployable protocol replacement.
