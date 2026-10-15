// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface IPaperTokenomicsInputSignatures {
    function setMintParams(uint256 arg0, uint256 arg1, uint256 arg2, uint256 arg3) external;
    function flatRate() external;
    function initialize(address arg0, address arg1) external;
    function trackedLpUsd() external;
    function owner() external;
    function paperToken() external;
    function tailDecayScaleUsd() external;
    function exchange() external;
    function redeem(uint256 arg0) external;
    function tailProgressUsd() external;
    function setPaperToken(address arg0) external;
    function lpFlatThresholdUsd() external;
    function transferOwnership(address arg0) external;
    function quoteRedemption(uint256 arg0) external;
}
