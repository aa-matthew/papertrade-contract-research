// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface IMultisigInputSignatures {
    function signerTwo() external;
    function signerThree() external;
    function revokeTransaction(uint256 arg0) external;
    function updateSigners(address arg0, address arg1, address arg2) external;
    function isSigner(address arg0) external;
    function requiredConfirmations() external;
    function epoch() external;
    function transactions(uint256 arg0) external;
    function transactionCount() external;
    function submitTransaction(address arg0, uint256 arg1, bytes calldata arg2) external;
    function signerOne() external;
}
