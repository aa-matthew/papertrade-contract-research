// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface IUSDCImplementationInputSignatures {
    function name() external;
    function approve(address arg0, uint256 arg1) external;
    function totalSupply() external;
    function unBlacklist(address arg0) external;
    function transferFrom(address arg0, address arg1, uint256 arg2) external;
    function updateRescuer(address arg0) external;
    function initializeV2_1(address arg0) external;
    function removeMinter(address arg0) external;
    function PERMIT_TYPEHASH() external;
    function decimals() external;
    function initialize(string calldata arg0, string calldata arg1, string calldata arg2, uint8 arg3, address arg4, address arg5, address arg6, address arg7) external;
    function masterMinter() external;
    function DOMAIN_SEPARATOR() external;
    function rescuer() external;
    function increaseAllowance(address arg0, uint256 arg1) external;
    function unpause() external;
    function mint(address arg0, uint256 arg1) external;
    function burn(uint256 arg0) external;
    function initializeV2_2(address[] calldata arg0, string calldata arg1) external;
    function configureMinter(address arg0, uint256 arg1) external;
    function version() external;
    function updatePauser(address arg0) external;
    function cancelAuthorization(address arg0, bytes32 arg1, uint8 arg2, bytes32 arg3, bytes32 arg4) external;
    function paused() external;
    function balanceOf(address arg0) external;
    function nonces(address arg0) external;
    function RECEIVE_WITH_AUTHORIZATION_TYPEHASH() external;
    function pause() external;
    function receiveWithAuthorization(address arg0, address arg1, uint256 arg2, uint256 arg3, uint256 arg4, bytes32 arg5, bytes calldata arg6) external;
    function minterAllowance(address arg0) external;
    function owner() external;
    function symbol() external;
    function pauser() external;
    function permit(address arg0, address arg1, uint256 arg2, uint256 arg3, bytes calldata arg4) external;
    function TRANSFER_WITH_AUTHORIZATION_TYPEHASH() external;
    function decreaseAllowance(address arg0, uint256 arg1) external;
    function transfer(address arg0, uint256 arg1) external;
    function updateMasterMinter(address arg0) external;
    function isMinter(address arg0) external;
    function updateBlacklister(address arg0) external;
    function rescueERC20(address arg0, address arg1, uint256 arg2) external;
    function cancelAuthorization(address arg0, bytes32 arg1, bytes calldata arg2) external;
    function blacklister() external;
    function transferWithAuthorization(address arg0, address arg1, uint256 arg2, uint256 arg3, uint256 arg4, bytes32 arg5, bytes calldata arg6) external;
    function permit(address arg0, address arg1, uint256 arg2, uint256 arg3, uint8 arg4, bytes32 arg5, bytes32 arg6) external;
    function initializeV2(string calldata arg0) external;
    function CANCEL_AUTHORIZATION_TYPEHASH() external;
    function allowance(address arg0, address arg1) external;
    function transferWithAuthorization(address arg0, address arg1, uint256 arg2, uint256 arg3, uint256 arg4, bytes32 arg5, uint8 arg6, bytes32 arg7, bytes32 arg8) external;
    function currency() external;
    function authorizationState(address arg0, bytes32 arg1) external;
    function receiveWithAuthorization(address arg0, address arg1, uint256 arg2, uint256 arg3, uint256 arg4, bytes32 arg5, uint8 arg6, bytes32 arg7, bytes32 arg8) external;
    function transferOwnership(address arg0) external;
    function blacklist(address arg0) external;
    function isBlacklisted(address arg0) external;
}
