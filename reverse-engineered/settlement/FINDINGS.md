# Settlement and queue reconstruction

This is new research over the archived runtime, using cast disassembly and read-only Anvil `eth_call` / `debug_traceCall`. It is not original Solidity, a full decompilation, an audited implementation, or proof of source equivalence. REA static provenance: `inspection/rea/ExchangeLinkedLibrary.stdout.json`, Evidence `ev_b68c5eaefdb516378fbff8bc62a4741e52f386b5bfbcc947fdd25abbb171b712` (evmole@0.9.3). REA reports interface candidates; the exact math and queue conclusions below come from additional disassembly and explicit runtime traces, not a REA Solidity decompiler. All program counters below are byte offsets into **ExchangeLinkedLibrary/runtime.hex**, unless specified as Exchange. Canonical raw artifacts remain under upstream/contracts.

## Answered: exact normal-range impact arithmetic

Selector **0xb67f3dd7**, dispatch 0x015d, body **0x10a8–0x1206**, accepts seven words: raw profit, uint64 entry, uint64 adjusted exit, base rate WAD, rate multiplier WAD, position multiplier WAD, reference notional WAD. Names and source-level signedness are reconstructions. The final arithmetic uses SDIV; the research helper restricts raw profit to positive values.

```
W = 10^18
move = floor(abs(adjustedExit-entry)*W/entry)
d1 = floor(move*rateMultiplier/W)
t1 = d1==0 ? UINT_MAX : floor(W²/d1)
d2 = floor(1_000_000*move*positionMultiplier/W)
t2 = d2==0 ? UINT_MAX : floor(referenceNotional*W/d2)
if difference==0 or t1>W² or t2>W²: return 0
scale = floor((W-baseRate)*W/(W+t1+t2))
retainedProfit = floor(rawProfit*scale/W)
```

Evidence: W constant at 0x10db; move calculation 0x10db–0x1106; W² constant at 0x1112; factor 1,000,000 at 0x1124; zero-denominator saturation branches 0x11d9 / 0x11e3; zero return 0x11c6; numerator/denominator and **separate scale truncation** 0x1181–0x11c3. Combining the two final divisions produces small but observable mismatches.

`haircut-tests.json`: **14/14 exact equality** comparisons against deployed library code on the local fork. Tests cover zero move, tiny move, larger moves, either price direction, and raw profits with odd remainders. These are synthetic positive-profit arguments, not economic predictions or proof for all uint256 inputs. `probe-haircut.mjs` reproduces them without writes. `SettlementMath.reconstructed.sol` is a research arithmetic helper with Solidity syntax; extreme overflow and integer-cast parity are explicitly outside its claim. No compiler was installed for this subtask.

## Answered: deadband and loss clamp, with ABI correction

**0x82296364 consumes NINE calldata words**, despite the old inferred input list containing only five. Its calldata length check requires 0x120 bytes excluding selector (0x01ad); it reads the final four arguments at offsets 0xa4, 0xc4, 0xe4 and 0x104 (0x02ba–0x02ca). Candidate encoding:

```
(uint64 entry,uint64 exit,uint128 margin,uint32 leverage,bool isLong,
 uint256 baseWad,uint256 rateWad,uint256 positionWad,uint256 referenceWad)
 -> (int256 rawPnl,int256 adjustedPnl)
```

The third word is masked to uint128 at 0x024b; the earlier int256 inference is not reliable source typing. Favorable movement first loses `floor(entry/50000)` price units (0x01ff–0x0203). If favorable move is no greater than this, effective exit becomes entry; losing moves retain their original exit. Signed linear PnL uses margin times leverage and the resulting price difference, divided by entry (0x0254–0x027a). Positive results go through the impact function. Negative adjusted PnL is clamped to negative margin; **the first return remains the unclamped raw PnL**, even when below negative margin (0x0283–0x02b3).

`pnl-tests.json`: **22/22 exact two-word outputs** for long/short around deadband boundaries, losses and losses exceeding margin. The winning fee is absent from these helpers and belongs to higher-level settlement. `pnl-debug_traceCall.json` preserves one complete instruction trace. `symbolic-pnl.py` and `symbolic-trace.py` annotate symbolic expressions; they follow one concrete trace and do not prove unexplored branches.

## Answered: FIFO cash payouts, LIFO collateral consumption

`Queue.pseudocode.txt` records layout and algorithms. The packed per-user doubly linked list is a concrete discovery beyond the old docs: users consume **newest** claims as collateral while cash harvesting pays **oldest global** entries. This preserves the older user's place in the cash payout order.

**0x3f4e3626's third argument is uint256 amount, not bool.** Decoder 0x0a67–0x0a90 reads the word without boolean validation; a successful amount=75 probe confirms unrestricted amount interpretation. Thus old inferred library interfaces must not be used as authoritative ABI.

`queue-override-tests.json` captures five successful, isolated calls using an ephemeral minimal delegatecall harness. Storage overrides exist only within read-only `debug_traceCall`; neither a transaction nor persistent local/mainnet write occurred. Each trace records exact SSTORE PC, slot and value. Starting with IDs 1 and 2:

1. Append 100, then 200 for the same user: total=300.
2. Harvest budget 50: oldest claim becomes 50; total=250; cash balance credit=50.
3. Consume collateral 75: newest claim becomes 125; oldest stays 50; total=175; no cash balance credit.
4. Harvest budget 100: clears oldest 50 and pays another 50 from newer claim; remaining=75; cash balance credit reaches150.

Append writes are at 0x0b81 / 0x0c3c / 0x0c50 / 0x0c82 / 0x0c93 / 0x0ca9. Next-user bits written at 0x0b14–0x0b39, previous-user bits at 0x0b3b–0x0b5d. Harvest partial-amount update at 0x04b8, balance credit 0x0445, user debt decrement 0x045f, global head/total writes 0x04e9/0x04f0. Collateral-consumption amount write 0x05c1 and global/user total writes 0x05f8/0x0602.

## Partial: Exchange cash/debt routing and storage

Read-only getter traces in `storage-getter-traces.json` recover implementation SLOAD locations (proxy SLOADs are separately depth1). Observations: treasury 0x0e; queue head0x10; totalQueued0x12; totalBalances and totalLockedMargin share packed0x16; both fee accumulators share packed0x1a; sideBucket0x1b; tokenomics0x06; oracle0x02. The queue is based at0x0f, demonstrated by both actual Exchange calls passing base0x0f and the ephemeral node layout tests. Field masks must be read before treating shared slots as full-width integers.

The docs and prior local smoke evidence say surviving cash margin is credited immediately, profits can be queued, debt-funded positions consume claims, and debt losses bring no USDC. This subtask concretely confirms claim destruction and payout credit mechanics. It does **not** yet establish the complete high-level Exchange settlement order, fee carve, side-bucket transitions, liquidations, debt-funded winning restoration rules, or all access guards. Do not substitute this queue pseudocode for complete settlement code. The prior smoke suite covers cash-funded close and liquidation only and uses explicit oracle/collateral fixtures.

## Remaining questions

- Recover higher-level helper selectors 0x2448a553, 0x32db40c9, 0x3cf4208d, 0xca02ff91, 0xef1a27a9 and their exact cash/debt settlement distinctions.
- Verify 2% fee rounding and partial-fee allocation from bytecode, beyond documentary description.
- Recover queue reordering/merge helpers, partial debt return on close, and max-entry/accumulator argument nuances under all branches.
- Verify extreme uint64 addition, uint128 casts, int256 overflow and denominator saturation against the helper before production reuse.
- No original source licensing or source-equivalent recompile established.
