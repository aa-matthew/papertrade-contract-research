// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
import "../token/MintCurve.reconstructed.sol";
import "../settlement/SettlementMath.reconstructed.sol";

/// Test adapter for reconstructed helpers. It is not part of the original protocol.
contract ResearchMathHarness {
    function quote(int256 lp,uint256 h,uint256 basis,int256 threshold,uint256 rate,uint256 scale)
        external pure returns(uint256,uint256) {
        return MintCurveReconstructed.quote(lp,h,basis,threshold,rate,scale);
    }
    function retainedProfit(uint256 raw,uint64 entry,uint64 exit,uint256 base,uint256 rate,uint256 position,uint256 reference_)
        external pure returns(uint256) {
        return SettlementMathReconstructed.retainedProfit(raw,entry,exit,base,rate,position,reference_);
    }
    function pnl(uint64 entry,uint64 exit,uint128 margin,uint32 leverage,bool isLong,uint256 base,uint256 rate,uint256 position,uint256 reference_)
        external pure returns(int256,int256) {
        return SettlementMathReconstructed.pnl(entry,exit,margin,leverage,isLong,base,rate,position,reference_);
    }
}
