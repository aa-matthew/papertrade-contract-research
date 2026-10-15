# PAPER, LP solvency and fee scheme

This describes the captured official documentation and observed getters. Documentation parameters are mutable and must not be assumed current forever. Original PaperTokenomics/QueueLib Solidity is unavailable; see the bytecode archive and local behavioral evidence.

## Token supply and authority

- Token name/symbol: Paper / PAPER; 18 decimals.
- PaperTokenomics is the observed minter; PaperStaking is the observed staking contract.
- Docs describe zero initial supply, no premine, team/VC allocation, airdrop or vesting. These are documented launch claims, not a complete historical mint audit.
- Eligible realized trader losses and liquidations mint PAPER. Losses acquire exposure to future revenue; this is not redemption backing or guaranteed compensation.
- Ordinary wallet-to-wallet transfer is blocked in the tested captured implementation/state. Staking and unstaking work. Local tests distinguish unauthorized mint rejection from authorized local minting.
- Follow-up runtime analysis confirms `redeem(uint256)` and `quoteRedemption(uint256)` have disabled paths, including valid-argument probes at zero, one and 100 WAD; all return the observed `0x32aa90b0` error. See `reverse-engineered/token/TOKEN-RECONSTRUCTION.md`. The docs do not promise a redeemable LP share.

## Emission curve

Documentation defaults:

| Parameter | Value |
|---|---:|
| Flat rate | 100 PAPER per eligible USD loss basis |
| Flat-region threshold | $2,000,000 tracked LP |
| Tail decay scale S | $120,000,000 |
| Documented initial staker surplus cap | $5,000,000 |

Below the flat threshold, including negative tracked LP, the documented rate is the flat rate. In the tail region, with cumulative tail high-water progress H:

```text
marginal rate = 100 × (S / (S + H))²
```

H is a persistent one-way ratchet, not current LP cash. Staker drains reduce tracked LP without undoing the tail high-water mark. A displayed `flatRate` of 100 is therefore not proof the effective tail mint rate is 100. Boundary crossing, integration over a finite loss and fixed-point rounding require the actual implementation; multiplying a large loss by one marginal quote is not an exact reproduction.

Follow-up bytecode/trace work recovered the integrated finite-loss formula and each truncation; [the reconstructed helper](../reverse-engineered/token/MintCurve.reconstructed.sol) matches the original runtime on the recorded normal-range vectors. This strengthens the earlier economic description without establishing extreme integer or full source equivalence.

Local evidence: the smoke liquidation forfeited $100 margin and minted approximately 1,697.68 PAPER at its forked state, rather than 10,000 PAPER. The exact result is recorded in `local/smoke-results.json`; it depends on the captured ratchet state.

## What contributes to mint basis

| Event | Eligible basis described by docs |
|---|---|
| Cash-funded loss, queue empty | Realized loss minus LP-side loss fee |
| Cash-funded loss, queue active | Full realized loss; loss fee waived |
| Cash-funded liquidation | Full lost margin, even if LP receives margin net of fee |
| Debt-funded losing close | Destroyed queue claim, net of loss fee when charged |
| Debt-funded liquidation | Entire destroyed claim; no liquidation fee |

Debt-funded losses do not bring new USDC into the system. Mint basis, tracked LP and free cash must be inspected separately.

## Winning PnL and fees

Raw linear PnL is not the final profit. A winning close first applies a 0.2-basis-point less favorable exit, then the impact curve, then a 2% fee on the adjusted profit.

```text
scale = (1 − baseRate) / (1 + term1 + term2)
term1 = 1 / (move × rateMultiplier)
term2 = referenceNotional / (10^6 × move × positionMultiplier)
adjustedProfit = profitAfterDeadband × scale
traderProfit = adjustedProfit × 0.98
```

The documented launch defaults are baseRate 10%, rateMultiplier 15,000, reference notional $100,000, and positionMultiplier 814.598 for BTC / 483.979 for ETH. The scale uses the post-deadband move. This is an economic description; Solidity unit normalization and rounding require bytecode/source-level analysis.

The haircut depends on move and per-market reference parameters, not actual position size. Half of each payable 2% fee goes to stakers and half to the developer fee recipient. Loss fees are carved from the house's gain rather than charged on top of the trader's loss. Fee routing is subordinated to queued payouts and available cash. Planned builder-code economics are documented as not yet live; the archived page describes a planned 1% share of the LP-revenue carve, not an extra notional trading fee.

Local profitable-close evidence: a $100 margin position at 100× under an approximately +1% BTC fixture move returned margin plus approximately $86.38 net profit. See the exact result and fixture qualifications in the smoke report.

## House pool and queue

The house starts without conventional external LP deposits in the documented model and accumulates trader losses. Winning trades face that house directly; no corresponding Hyperliquid hedge is opened.

Separate accounting concepts:

1. Treasury: all tracked funds, including user balances, locked margin and liabilities.
2. Free LP cash: funds left after user balances, margins and fee reserves; cannot go below zero.
3. Side bucket: cash earmarked for queued winners while debt exists.
4. FIFO queue: unpaid settlement claims; contingent debt, not withdrawable cash.
5. Tracked LP: a separate running economic tally used for emissions and surplus policies.

Net LP equity may be negative even when unsigned cash fields are nonnegative. Queue ordering prevents new winners jumping ahead; it does not guarantee future inflows, a repayment date, or eventual payment. Cash-funded surviving margin is credited separately from unpaid profit. Queued claims can be consumed as collateral for new trades, creating a second settlement branch whose losses destroy claims rather than create cash.

## Staking and surplus

Staking has no documented lockup, cooldown, boosts or tiers. New distributable USDC increases the global `accRewardPerShare`; each user's stake and reward debt determine their pending claim. Direct public distribution is disabled in favor of a signed keeper/relayer path. Claiming credits the user's Exchange balance rather than implying an arbitrary external-wallet transfer.

Two documented sources fund distributions: half of eligible trading fees and tracked LP surplus above the configured cap. `pushStakerFees` and distribution are separate steps. The cap and emissions parameters can change through governance; the archived launch defaults are not a hardcoded perpetual promise.

No full lifetime accounting reconciliation, historical wash-trading analysis or proof of economic sustainability has been performed in this workspace.
