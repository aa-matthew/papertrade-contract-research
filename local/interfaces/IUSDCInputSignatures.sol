// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface IUSDCInputSignatures {
    function upgradeTo(address arg0) external;
    function upgradeToAndCall(address arg0, bytes calldata arg1) external;
    function implementation() external;
    function changeAdmin(address arg0) external;
    function admin() external;
}
