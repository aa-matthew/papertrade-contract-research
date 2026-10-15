// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface ITimelockInputSignatures {
    function hashOperationBatch(address[] calldata arg0, uint256[] calldata arg1, bytes[] calldata arg2, bytes32 arg3) external;
    function isOperationReady(bytes32 arg0) external;
    function isOperationDone(bytes32 arg0) external;
    function isOperationPending(bytes32 arg0) external;
    function operationTimestamps(bytes32 arg0) external;
    function execute(address arg0, uint256 arg1, bytes calldata arg2, bytes32 arg3) external;
    function updateMinDelay(uint256 arg0) external;
    function scheduleBatch(address[] calldata arg0, uint256[] calldata arg1, bytes[] calldata arg2, bytes32 arg3) external;
    function owner() external;
    function executeBatch(address[] calldata arg0, uint256[] calldata arg1, bytes[] calldata arg2, bytes32 arg3) external;
    function schedule(address arg0, uint256 arg1, bytes calldata arg2, bytes32 arg3) external;
    function cancel(bytes32 arg0) external;
    function minDelay() external;
    function hashOperation(address arg0, uint256 arg1, bytes calldata arg2, bytes32 arg3) external;
    function transferOwnership(address arg0) external;
}
