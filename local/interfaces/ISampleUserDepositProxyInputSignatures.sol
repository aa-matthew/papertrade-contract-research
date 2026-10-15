// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface ISampleUserDepositProxyInputSignatures {
    function withdrawStuckToken(address arg0, uint256 arg1) external;
    function user() external;
    function exchange() external;
}
