// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IExecutionOracle {
    /// @return priceWad USD price with 18 decimals; publishTime observation time.
    function price(uint32 market) external view returns (uint256 priceWad, uint64 publishTime);
}

interface IRewardSink { function notifyReward(uint256 amount) external; }
interface IProtocolToken { function mint(address user, uint256 amount) external; }
