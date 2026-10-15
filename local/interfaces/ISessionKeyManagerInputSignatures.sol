// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface ISessionKeyManagerInputSignatures {
    function CLOSE_TYPEHASH() external;
    function DOMAIN_SEPARATOR() external;
    function setAuthorizedSubmitter(address arg0, bool arg1) external;
    function registerSessionKeyBySig(address arg0, address arg1, uint64 arg2, address arg3, uint256 arg4, uint64 arg5, uint8 arg6, bytes32 arg7, bytes32 arg8) external;
    function OPEN_POSITION_TYPEHASH() external;
    function initialize(address arg0, string calldata arg1, string calldata arg2, uint256 arg3, address arg4) external;
    function domainSeparatorV4() external;
    function nonces(address arg0) external;
    function authorizedSubmitters(address arg0) external;
    function revokeSessionKey(address arg0) external;
    function owner() external;
    function sessionKeys(address arg0, address arg1) external;
    function authorizedCaller() external;
    function isNonceUsed(address arg0, uint256 arg1) external;
    function setAuthorizedCaller(address arg0) external;
    function recoverSigner(bytes32 arg0, uint8 arg1, bytes32 arg2, bytes32 arg3) external;
    function transferOwnership(address arg0) external;
}
