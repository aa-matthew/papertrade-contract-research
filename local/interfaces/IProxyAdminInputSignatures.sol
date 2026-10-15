// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface IProxyAdminInputSignatures {
    function changeProxyAdmin(address arg0, address arg1) external;
    function owner() external;
    function upgradeAndCall(address arg0, address arg1, bytes calldata arg2) external;
    function upgrade(address arg0, address arg1) external;
    function transferOwnership(address arg0) external;
}
