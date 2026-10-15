// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

contract ProtocolStaking is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    IERC20 public immutable participation;
    IERC20 public immutable collateral;
    address public exchange;
    uint256 public totalStaked;
    uint256 public accumulator;
    uint256 public rewardReserve;
    uint256 public pendingWithoutStake;
    mapping(address => uint256) public staked;
    mapping(address => uint256) public debt;
    mapping(address => uint256) public earned;
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event Claimed(address indexed user, uint256 amount);
    event RewardAdded(uint256 amount);

    constructor(address owner_, IERC20 token_, IERC20 collateral_) Ownable(owner_) {
        participation = token_; collateral = collateral_;
    }
    function wire(address exchange_) external onlyOwner {
        require(exchange == address(0) && exchange_.code.length > 0, "wire once"); exchange = exchange_;
    }
    function _checkpoint(address user) private {
        uint256 accrued = Math.mulDiv(staked[user], accumulator, 1e27);
        earned[user] += accrued - debt[user];
        debt[user] = accrued;
    }
    function stake(uint256 amount) external nonReentrant {
        require(amount > 0, "zero");
        _checkpoint(msg.sender);
        participation.safeTransferFrom(msg.sender, address(this), amount);
        staked[msg.sender] += amount; totalStaked += amount;
        debt[msg.sender] = Math.mulDiv(staked[msg.sender], accumulator, 1e27);
        // Rewards received with no stakers remain parked until a later notification.
        emit Staked(msg.sender, amount);
    }
    function unstake(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= staked[msg.sender], "stake");
        _checkpoint(msg.sender);
        staked[msg.sender] -= amount; totalStaked -= amount;
        debt[msg.sender] = Math.mulDiv(staked[msg.sender], accumulator, 1e27);
        participation.safeTransfer(msg.sender, amount);
        emit Unstaked(msg.sender, amount);
    }
    function notifyReward(uint256 amount) external nonReentrant {
        require(msg.sender == exchange, "exchange only");
        require(collateral.balanceOf(address(this)) >= rewardReserve + amount, "not funded");
        rewardReserve += amount;
        uint256 distributable = pendingWithoutStake + amount;
        if (totalStaked == 0) pendingWithoutStake = distributable;
        else { pendingWithoutStake = 0; accumulator += Math.mulDiv(distributable, 1e27, totalStaked); }
        emit RewardAdded(amount);
    }
    function pending(address user) external view returns (uint256) {
        return earned[user] + Math.mulDiv(staked[user], accumulator, 1e27) - debt[user];
    }
    function claim() external nonReentrant returns (uint256 amount) {
        _checkpoint(msg.sender); amount = earned[msg.sender]; earned[msg.sender] = 0;
        rewardReserve -= amount;
        collateral.safeTransfer(msg.sender, amount);
        emit Claimed(msg.sender, amount);
    }
}
