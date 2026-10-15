// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface ICoreDepositWalletInputSignatures {
    struct RecoveredTuple0 { address field0; address field1; address field2; }
    function updateRescuer(address arg0) external;
    function deposit(uint256 arg0, uint32 arg1) external;
    function rescuer() external;
    function unpause() external;
    function tokenMessenger() external;
    function updatePauser(address arg0) external;
    function paused() external;
    function coreReceiveWithData(address arg0, bytes32 arg1, uint32 arg2, uint256 arg3, uint64 arg4, bytes calldata arg5) external;
    function acceptOwnership() external;
    function pause() external;
    function owner() external;
    function pauser() external;
    function transfer(address arg0, uint256 arg1) external;
    function rescueERC20(address arg0, address arg1, uint256 arg2) external;
    function depositFor(address arg0, uint256 arg1, uint32 arg2) external;
    function initialize(RecoveredTuple0 calldata arg0) external;
    function pendingOwner() external;
    function cctpMaxFee() external;
    function transferOwnership(address arg0) external;
    function token() external;
}
