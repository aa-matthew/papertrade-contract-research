// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

library Economics {
    uint256 internal constant W = 1e18;
    struct Impact { uint256 base; uint256 rate; uint256 position; uint256 referenceUsd; }

    function pnl(uint256 entry, uint256 exit, uint256 margin, uint256 leverage, bool isLong, Impact memory p)
        internal pure returns (int256 adjusted)
    {
        bool winning = isLong ? exit > entry : exit < entry;
        uint256 distance = exit > entry ? exit - entry : entry - exit;
        if (!winning) return -int256(Math.min(margin, Math.mulDiv(margin * leverage, distance, entry)));
        uint256 deadband = entry / 50_000;
        if (distance <= deadband) return 0;
        distance -= deadband;
        uint256 raw = Math.mulDiv(margin * leverage, distance, entry);
        uint256 move = Math.mulDiv(distance, W, entry);
        uint256 d1 = Math.mulDiv(move, p.rate, W);
        uint256 d2 = Math.mulDiv(move, p.position * 1_000_000, W);
        if (d1 == 0 || d2 == 0) return 0;
        uint256 t1 = Math.mulDiv(W, W, d1);
        uint256 t2 = Math.mulDiv(p.referenceUsd, W, d2);
        uint256 scale = Math.mulDiv(W - p.base, W, W + t1 + t2);
        return int256(Math.mulDiv(raw, scale, W));
    }

    /// WAD loss basis and LP progress; fixed-point floors are intentionally separate.
    function mintQuote(int256 lp, uint256 progress, uint256 basis, int256 threshold, uint256 flatRate, uint256 scale)
        internal pure returns (uint256 minted, uint256 tailBasis)
    {
        uint256 flat;
        if (lp < threshold) flat = Math.min(basis, uint256(threshold - lp));
        minted = Math.mulDiv(flat, flatRate, W);
        tailBasis = basis - flat;
        if (tailBasis != 0) {
            uint256 q0 = Math.mulDiv(scale, W, scale + progress);
            uint256 q1 = Math.mulDiv(scale, W, scale + progress + tailBasis);
            uint256 rate = Math.mulDiv(Math.mulDiv(flatRate, q0, W), q1, W);
            minted += Math.mulDiv(rate, tailBasis, W);
        }
    }
}
