// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface IPaperTokenInputSignatures {
    function name() external;
    function minter() external;
    function approve(address arg0, uint256 arg1) external;
    function totalSupply() external;
    function transferFrom(address arg0, address arg1, uint256 arg2) external;
    function decimals() external;
    function mint(address arg0, uint256 arg1) external;
    function balanceOf(address arg0) external;
    function owner() external;
    function initialize(string calldata arg0, string calldata arg1, address arg2, address arg3) external;
    function symbol() external;
    function burn(address arg0, uint256 arg1) external;
    function setStakingContract(address arg0) external;
    function transfer(address arg0, uint256 arg1) external;
    function allowance(address arg0, address arg1) external;
    function stakingContract() external;
    function transferOwnership(address arg0) external;
    function setMinter(address arg0) external;
}
