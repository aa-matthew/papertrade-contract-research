// SPDX-License-Identifier: UNLICENSED
pragma solidity >=0.8.0;

// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.
// Names are selector-matched candidates; collisions possible.
// Return types, mutability and access control are deliberately unspecified.
// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.
interface IExchangeInputSignatures {
    function sweep(address arg0) external;
    function totalLockedMargin() external;
    function sessionKeyManager() external;
    function lpBankrollAvailable() external;
    function authorizedExecutor() external;
    function openPosition(uint32 arg0, bool arg1, uint128 arg2, uint32 arg3) external;
    function marketKeeper() external;
    function pauseGuardian() external;
    function closeBySig(address arg0, uint256[] calldata arg1, uint256 arg2, uint64 arg3, uint8 arg4, bytes32 arg5, bytes32 arg6) external;
    function balances(address arg0) external;
    function pauseMarket(uint32 arg0) external;
    function liquidate(uint256 arg0) external;
    function setPauseGuardian(address arg0) external;
    function totalQueued() external;
    function tradingPaused() external;
    function close(uint256[] calldata arg0) external;
    function liquidateBatch(uint256[] calldata arg0) external;
    function liquidationFeeRate() external;
    function treasury() external;
    function openPosition(uint32 arg0, bool arg1, uint128 arg2, uint32 arg3, bool arg4) external;
    function pushStakerFees() external;
    function devFeeAccumulator() external;
    function oracle() external;
    function withdrawToCore(uint256 arg0) external;
    function setSessionKeyManager(address arg0) external;
    function changeDevFeeAddress(address arg0) external;
    function claimDevFees() external;
    function nextPositionId() external;
    function withdrawToCoreBySig(address arg0, uint256 arg1, uint256 arg2, uint64 arg3, uint8 arg4, bytes32 arg5, bytes32 arg6) external;
    function owner() external;
    function sideBucket() external;
    function queueHead() external;
    function positions(uint256 arg0) external;
    function authorizedKeeper() external;
    function setPaperTokenomics(address arg0) external;
    function getUserOpenPositionIds(address arg0) external;
    function totalBalances() external;
    function setTradingPaused(bool arg0) external;
    function stakerFeeAccumulator() external;
    function positionOwner(uint256 arg0) external;
    function initialize(address arg0, address arg1, address arg2) external;
    function proxyFactory() external;
    function devFeeRecipient() external;
    function setAuthorizedExecutor(address arg0) external;
    function userQueueHead(address arg0) external;
    function harvest(uint256 arg0) external;
    function requestSweep(address arg0) external;
    function setFeeRates(uint256 arg0, uint256 arg1, uint256 arg2) external;
    function creditStakingReward(address arg0, uint256 arg1) external;
    function queueNode(uint256 arg0) external;
    function collateralScale() external;
    function openPositionBySig(address arg0, uint32 arg1, bool arg2, uint128 arg3, uint32 arg4, bool arg5, uint256 arg6, uint64 arg7, uint8 arg8, bytes32 arg9, bytes32 arg10) external;
    function paperTokenomics() external;
    function setAuthorizedKeeper(address arg0) external;
    function instrumentCount() external;
    function transferOwnership(address arg0) external;
    function unpauseMarket(uint32 arg0) external;
    function setProxyFactory(address arg0) external;
}
