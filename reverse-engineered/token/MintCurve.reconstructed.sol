// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// Agent reconstruction from runtime PC 0x00c6..0x0212 at
/// 0xe991817199363046da0a28da6fbad0284e4aa492, corroborated with local eth_call.
/// NOT original source, NOT claimed bytecode equivalent or suitable for deployment.
library MintCurveReconstructed {
    uint256 internal constant WAD = 1e18;
    function quote(int256 lp, uint256 h, uint256 basis, int256 threshold,
                   uint256 rate, uint256 scale)
        internal pure returns (uint256 minted, uint256 tailBasis)
    {
        if (basis == 0) return (0,0);
        // Runtime adds the raw uint256 basis word using signed overflow checking.
        // This readable reconstruction only asserts behavior for basis <= int256.max.
        require(basis <= uint256(type(int256).max), "reconstruction input bound");
        int256 end = lp + int256(basis);
        uint256 flatBasis;
        if (lp < threshold) {
            flatBasis = end < threshold ? basis : uint256(threshold - lp);
            minted = (flatBasis * rate) / WAD;
        }
        tailBasis = basis - flatBasis;
        if (tailBasis != 0) {
            uint256 q0 = scale * WAD / (scale + h);
            uint256 q1 = scale * WAD / (scale + h + tailBasis);
            // Preserve EVERY floor: a rational closed form has different rounding.
            uint256 effectiveRate = ((rate * q0) / WAD * q1) / WAD;
            minted += effectiveRate * tailBasis / WAD;
        }
    }
}
