// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface IBatchExecutorInputSignatures {
    struct RecoveredTuple0 { address field0; bytes field1; bool field2; bytes32 field3; bytes32 field4; }
    function sessionKeyManager() external;
    function execute(RecoveredTuple0[] calldata arg0) external;
    function authorizedRelayers(address arg0) external;
    function owner() external;
    function setAuthorizedRelayer(address arg0, bool arg1) external;
    function initialize(address arg0, address arg1, address arg2) external;
    function exchange() external;
    function paperStaking() external;
    function transferOwnership(address arg0) external;
}
