// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

/// Research reconstruction, NOT original Papertrade source or a deployable exchange.
/// Selector names here are invented descriptive names. See FINDINGS.md.
/// Matches tested normal-range vectors; extreme uint/int overflow behavior is not equivalent.
library SettlementMathReconstructed {
    uint256 internal constant WAD = 1e18;

    // Archived library selector 0xb67f3dd7, body PCs 0x10a8–0x1206.
    // rawProfit must be positive. Caller has already applied the deadband.
    function retainedProfit(
        uint256 rawProfit, uint64 entry, uint64 adjustedExit,
        uint256 baseRateWad, uint256 rateMultiplierWad,
        uint256 positionMultiplierWad, uint256 referenceNotionalWad
    ) internal pure returns (uint256) {
        uint256 difference = entry > adjustedExit ? entry - adjustedExit : adjustedExit - entry;
        if (difference == 0) return 0;
        uint256 moveWad = difference * WAD / entry;
        uint256 denominator1 = moveWad * rateMultiplierWad / WAD;
        uint256 denominator2 = 1_000_000 * moveWad * positionMultiplierWad / WAD;
        uint256 term1 = denominator1 == 0 ? type(uint256).max : WAD * WAD / denominator1;
        uint256 term2 = denominator2 == 0 ? type(uint256).max : referenceNotionalWad * WAD / denominator2;
        if (term1 > WAD * WAD || term2 > WAD * WAD) return 0;
        // Separate truncation of scale is observable; do not algebraically combine.
        uint256 scaleWad = (WAD - baseRateWad) * WAD / (WAD + term1 + term2);
        return rawProfit * scaleWad / WAD;
    }

    // Archived selector 0x82296364. Nine calldata words, not five.
    // Returns deadband-adjusted raw PnL and impact-adjusted/clamped PnL; excludes win fee.
    // PCs 0x01ac–0x0378; favorable deadband floor(entry/50_000).
    function pnl(
        uint64 entry, uint64 exit, uint128 margin, uint32 leverage, bool isLong,
        uint256 baseRateWad, uint256 rateMultiplierWad,
        uint256 positionMultiplierWad, uint256 referenceNotionalWad
    ) internal pure returns (int256 raw, int256 adjusted) {
        uint64 deadband = entry / 50_000;
        uint64 effectiveExit = exit;
        if (isLong && exit > entry) effectiveExit = exit > entry + deadband ? exit - deadband : entry;
        if (!isLong && exit < entry) effectiveExit = exit + deadband < entry ? exit + deadband : entry;
        int256 difference = isLong ? int256(uint256(effectiveExit)) - int256(uint256(entry))
                                  : int256(uint256(entry)) - int256(uint256(effectiveExit));
        raw = int256(uint256(margin) * leverage) * difference / int256(uint256(entry));
        if (raw > 0) adjusted = int256(retainedProfit(uint256(raw), entry, effectiveExit,
            baseRateWad, rateMultiplierWad, positionMultiplierWad, referenceNotionalWad));
        else adjusted = raw < -int256(uint256(margin)) ? -int256(uint256(margin)) : raw;
    }
}
