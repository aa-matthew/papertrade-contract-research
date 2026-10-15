// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface IPriceOracleInputSignatures {
    function getOraclePrice(uint32 arg0) external;
    function owner() external;
    function getMarkPrice(uint32 arg0) external;
    function getExecutionPrice(uint32 arg0) external;
    function initialize(address arg0) external;
    function transferOwnership(address arg0) external;
    function getBBO(uint32 arg0) external;
}
