// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface IPaperStakingInputSignatures {
    function UNSTAKE_TYPEHASH() external;
    function authorizedExecutor() external;
    function unallocatedRewards() external;
    function unstake(uint256 arg0) external;
    function pendingRewards(address arg0) external;
    function DOMAIN_SEPARATOR() external;
    function claim() external;
    function stakeToken() external;
    function rewardDebt(address arg0) external;
    function stakedBalance(address arg0) external;
    function CLAIM_TYPEHASH() external;
    function domainSeparatorV4() external;
    function nonces(address arg0) external;
    function totalStaked() external;
    function stakeBySig(address arg0, uint256 arg1, uint256 arg2, uint64 arg3, uint8 arg4, bytes32 arg5, bytes32 arg6) external;
    function STAKE_TYPEHASH() external;
    function owner() external;
    function accRewardPerShare() external;
    function claimBySig(address arg0, uint256 arg1, uint64 arg2, uint8 arg3, bytes32 arg4, bytes32 arg5) external;
    function stake(uint256 arg0) external;
    function initialize(address arg0, address arg1, address arg2) external;
    function rewardReserve() external;
    function isNonceUsed(address arg0, uint256 arg1) external;
    function setAuthorizedExecutor(address arg0) external;
    function exchange() external;
    function distribute() external;
    function distributeBySig(address arg0, uint256 arg1, uint64 arg2, uint8 arg3, bytes32 arg4, bytes32 arg5) external;
    function transferOwnership(address arg0) external;
    function pendingReward(address arg0) external;
    function rewardToken() external;
    function unstakeBySig(address arg0, uint256 arg1, uint256 arg2, uint64 arg3, uint8 arg4, bytes32 arg5, bytes32 arg6) external;
}
