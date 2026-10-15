// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IExecutionOracle, IProtocolToken, IRewardSink} from "./Interfaces.sol";
import {Economics} from "./Economics.sol";

/// Original v0.1 research implementation for Robinhood Chain.
/// All collateral accounting is raw 6-decimal token units. Prices/emission math are WAD.
/// Cash-funded positions only: queued profits cannot fund new positions in this version.
contract Exchange is Ownable, ReentrancyGuard, EIP712 {
    using SafeERC20 for IERC20;
    uint256 public constant TO_WAD = 1e12;
    bytes32 public constant ORDER_TYPEHASH = keccak256("Order(address user,uint32 market,uint256 positionId,uint128 margin,uint32 leverage,bool isLong,uint256 priceLimit,uint256 nonce,uint64 deadline)");
    struct Market {
        bool enabled; uint32 maxLeverage; uint32 delay; uint32 executionWindow;
        uint16 bustBufferBps; uint128 minMargin; uint128 maxMargin;
        uint256 sideCap; Economics.Impact impact;
    }
    struct Position {
        address user; uint32 market; uint32 leverage; bool isLong; uint16 bustBufferBps;
        uint128 margin; uint64 openedAt; uint256 entry; Economics.Impact impact;
    }
    struct Order {
        address user; uint32 market; uint256 positionId; uint128 margin; uint32 leverage;
        bool isLong; uint256 priceLimit; uint256 nonce; uint64 deadline;
    }
    struct Pending { Order order; uint64 eligibleAt; uint64 lastObservation; bool done; address signer; uint256 sessionVersion; }
    struct Claim { address user; uint256 amount; }
    struct Session { uint64 expiry; uint128 marginBudget; }

    IERC20 public immutable collateral;
    IExecutionOracle public immutable oracle;
    IProtocolToken public immutable participation;
    IRewardSink public immutable staking;
    address public guardian;
    address public developer;
    bool public opensPaused = true;
    uint256 public houseCash;
    uint256 public totalBalances;
    uint256 public lockedMargin; // includes reserved pending-open margin
    uint256 public stakerFees;
    uint256 public developerFees;
    uint256 public totalQueued;
    uint256 public openCount;
    uint256 public pendingOpenCount;
    uint256 public nextPosition = 1;
    uint256 public nextOrder = 1;
    uint256 public queueHead = 1;
    uint256 public queueTail = 1;
    int256 public trackedLpWad;
    uint256 public tailProgressWad;
    uint256 public immutable flatThresholdWad = 2_000_000e18;
    uint256 public immutable decayScaleWad = 120_000_000e18;
    uint256 public houseCap = 5_000_000e6;
    mapping(address => uint256) public balances;
    mapping(address => uint256) public queued;
    mapping(uint32 => Market) public markets;
    mapping(uint32 => uint256) public longNotional;
    mapping(uint32 => uint256) public shortNotional;
    mapping(uint256 => Position) public positions;
    mapping(uint256 => Pending) public pendingOrders;
    mapping(uint256 => uint256) public closeOrder;
    mapping(uint256 => Claim) public claims;
    mapping(address => mapping(uint256 => uint256)) public nonceBitmap;
    mapping(address => mapping(address => Session)) public sessions;
    mapping(address => mapping(address => uint256)) public sessionVersions;
    mapping(uint32 => uint256) public pendingOpens;
    mapping(uint32 => uint256) public retiredPrice;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event LiquiditySeeded(address indexed donor, uint256 amount);
    event OrderRequested(uint256 indexed order, address indexed user, uint256 eligibleAt);
    event OrderCancelled(uint256 indexed order);
    event Opened(uint256 indexed position, address indexed user, uint32 indexed market, uint256 entry, uint256 margin, uint32 leverage);
    event Closed(uint256 indexed position, address indexed user, int256 pnl, bool liquidated);
    event Queued(uint256 indexed claim, address indexed user, uint256 amount);
    event Harvested(uint256 indexed claim, address indexed user, uint256 amount);
    event ParticipationMinted(address indexed user, uint256 lossBasis, uint256 amount);
    event MarketConfigured(uint32 indexed market);
    event MarketRetired(uint32 indexed market, uint256 price);
    event SessionSet(address indexed user, address indexed key, uint64 expiry, uint128 budget);
    event FeesPushed(uint256 stakingAmount, uint256 developerAmount);
    event OpensPauseChanged(bool paused);

    constructor(address owner_, address guardian_, address developer_, IERC20 collateral_, IExecutionOracle oracle_, IProtocolToken token_, IRewardSink staking_)
        Ownable(owner_) EIP712("Robinhood Synthetic Protocol", "1")
    {
        require(guardian_ != address(0) && developer_ != address(0), "roles");
        require(address(collateral_).code.length > 0 && address(oracle_).code.length > 0 && address(token_).code.length > 0 && address(staking_).code.length > 0, "contracts");
        require(IERC20Metadata(address(collateral_)).decimals() == 6, "6 decimals required");
        collateral = collateral_; oracle = oracle_; participation = token_; staking = staking_;
        guardian = guardian_; developer = developer_;
    }
    function configureMarket(uint32 id, Market calldata m) external onlyOwner {
        require(longNotional[id] + shortNotional[id] == 0 && pendingOpens[id] == 0, "positions/orders remain");
        require(retiredPrice[id] == 0 && m.maxLeverage > 0 && m.maxLeverage <= 100, "market/leverage");
        require(m.delay >= 2 && m.delay <= 60 && m.executionWindow >= 2 && m.executionWindow <= 60, "timing");
        require(m.bustBufferBps * m.maxLeverage < 10_000 && m.minMargin > 0 && m.maxMargin >= m.minMargin && m.maxMargin <= 1e18, "margin");
        require(m.sideCap > 0 && m.sideCap <= 1e24 && m.impact.base <= 5e17 && m.impact.rate > 0 && m.impact.rate <= 1e26 && m.impact.position > 0 && m.impact.position <= 1e26 && m.impact.referenceUsd <= 1e36, "risk/impact");
        markets[id] = m; emit MarketConfigured(id);
    }
    function setOpensPaused(bool flag) external {
        require(msg.sender == owner() || (msg.sender == guardian && flag), "authority");
        opensPaused = flag; emit OpensPauseChanged(flag);
    }
    function setRoles(address guardian_, address developer_) external onlyOwner {
        require(guardian_ != address(0) && developer_ != address(0), "zero"); guardian = guardian_; developer = developer_;
    }
    function setHouseCap(uint256 cap) external onlyOwner { require(cap >= 1_000e6 && cap <= 1e24, "cap"); houseCap = cap; }
    function retireMarket(uint32 market) external {
        require(msg.sender == guardian || msg.sender == owner(), "authority");
        require(retiredPrice[market] == 0 && markets[market].maxLeverage != 0, "retired/unknown");
        (uint256 value,) = oracle.price(market); require(value > 0, "price");
        retiredPrice[market] = value; markets[market].enabled = false;
        emit MarketRetired(market, value);
    }
    function setSession(address key, uint64 expiry, uint128 marginBudget) external {
        require(key != address(0) && key != msg.sender && expiry > block.timestamp && expiry <= block.timestamp + 30 days, "session");
        sessions[msg.sender][key] = Session(expiry, marginBudget);
        sessionVersions[msg.sender][key]++;
        emit SessionSet(msg.sender, key, expiry, marginBudget);
    }
    function revokeSession(address key) external { delete sessions[msg.sender][key]; sessionVersions[msg.sender][key]++; emit SessionSet(msg.sender, key, 0, 0); }
    function _receiveExact(address from, uint256 amount) private {
        uint256 before_ = collateral.balanceOf(address(this));
        collateral.safeTransferFrom(from, address(this), amount);
        require(collateral.balanceOf(address(this)) - before_ == amount, "unsupported token");
    }
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= 1e24, "amount"); _receiveExact(msg.sender, amount);
        balances[msg.sender] += amount; totalBalances += amount; emit Deposited(msg.sender, amount);
    }
    function withdraw(uint256 amount, address recipient) external nonReentrant {
        require(recipient != address(0) && amount > 0 && amount <= balances[msg.sender], "balance/recipient");
        balances[msg.sender] -= amount; totalBalances -= amount; collateral.safeTransfer(recipient, amount);
        emit Withdrawn(msg.sender, amount);
    }
    /// Non-redeemable capital contribution. No LP shares or privileged withdrawal.
    function seedLiquidity(uint256 amount) external nonReentrant {
        require(amount > 0 && amount <= 1e24, "amount"); _receiveExact(msg.sender, amount);
        houseCash += amount; emit LiquiditySeeded(msg.sender, amount);
    }
    function nonceUsed(address user, uint256 nonce) public view returns (bool) {
        return nonceBitmap[user][nonce >> 8] & (uint256(1) << (nonce & 255)) != 0;
    }
    function invalidateNonces(uint256 word, uint256 mask) external { nonceBitmap[msg.sender][word] |= mask; }
    function orderDigest(Order calldata o) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(ORDER_TYPEHASH, o.user, o.market, o.positionId, o.margin, o.leverage, o.isLong, o.priceLimit, o.nonce, o.deadline)));
    }
    function request(Order calldata o) external nonReentrant returns (uint256) {
        require(msg.sender == o.user, "user only"); return _request(o, o.user);
    }
    function requestBySig(Order calldata o, address signer, bytes calldata signature) external nonReentrant returns (uint256) {
        require(SignatureChecker.isValidSignatureNow(signer, orderDigest(o), signature), "signature");
        if (signer != o.user) {
            Session storage s = sessions[o.user][signer]; require(s.expiry >= block.timestamp, "session expired");
            if (o.positionId == 0) { require(o.margin <= s.marginBudget, "session budget"); s.marginBudget -= o.margin; }
        }
        return _request(o, signer);
    }
    function _request(Order calldata o, address signer) private returns (uint256 id) {
        require(o.user != address(0) && !nonceUsed(o.user, o.nonce), "user/nonce");
        Market memory m = markets[o.market]; require(m.maxLeverage > 0, "unknown market");
        uint64 eligible = uint64(block.timestamp + m.delay);
        require(o.deadline >= eligible && o.deadline <= eligible + m.executionWindow, "deadline");
        require(o.priceLimit > 0, "price limit");
        nonceBitmap[o.user][o.nonce >> 8] |= uint256(1) << (o.nonce & 255);
        id = nextOrder++;
        if (o.positionId == 0) {
            require(!opensPaused && m.enabled && o.margin >= m.minMargin && o.margin <= m.maxMargin && o.leverage > 0 && o.leverage <= m.maxLeverage, "open limits");
            require(balances[o.user] >= o.margin, "margin balance");
            balances[o.user] -= o.margin; totalBalances -= o.margin; lockedMargin += o.margin; pendingOpenCount++;
            pendingOpens[o.market]++;
        } else {
            Position storage p = positions[o.positionId];
            require(p.user == o.user && p.market == o.market && p.isLong == o.isLong && closeOrder[o.positionId] == 0, "position");
            require(o.margin == 0 && o.leverage == 0 && block.timestamp >= p.openedAt + 2, "close fields/hold");
            closeOrder[o.positionId] = id;
        }
        pendingOrders[id] = Pending(o, eligible, uint64(eligible + m.executionWindow), false, signer, sessionVersions[o.user][signer]);
        emit OrderRequested(id, o.user, eligible);
    }
    function cancel(uint256 id) external nonReentrant {
        Pending storage p = pendingOrders[id];
        require(p.order.user != address(0) && !p.done && (msg.sender == p.order.user || block.timestamp > p.order.deadline), "cancel");
        _cancel(id);
    }
    function _cancel(uint256 id) private {
        Pending storage p = pendingOrders[id]; p.done = true;
        if (p.order.positionId == 0) {
            uint256 amount = p.order.margin; lockedMargin -= amount; balances[p.order.user] += amount; totalBalances += amount; pendingOpenCount--;
            pendingOpens[p.order.market]--;
        } else closeOrder[p.order.positionId] = 0;
        emit OrderCancelled(id);
    }
    function execute(uint256 id) external nonReentrant returns (uint256 positionId) {
        Pending storage pending = pendingOrders[id]; Order memory o = pending.order;
        require(o.user != address(0) && !pending.done && block.timestamp >= pending.eligibleAt && block.timestamp <= o.deadline, "execution time/state");
        if (pending.signer != o.user) require(sessions[o.user][pending.signer].expiry >= block.timestamp && sessionVersions[o.user][pending.signer] == pending.sessionVersion, "session revoked/expired");
        uint256 value = retiredPrice[o.market];
        if (value == 0) {
            uint64 observed; (value, observed) = oracle.price(o.market);
            require(observed >= pending.eligibleAt && observed <= pending.lastObservation && observed <= o.deadline, "observation window");
        } else require(o.positionId != 0, "retired market");
        require(value > 0 && value <= 1e36, "price");
        bool buy = o.positionId == 0 ? o.isLong : !o.isLong;
        require(buy ? value <= o.priceLimit : value >= o.priceLimit, "price limit");
        pending.done = true;
        if (o.positionId == 0) {
            Market memory m = markets[o.market]; require(!opensPaused && m.enabled && o.leverage <= m.maxLeverage, "opens paused");
            uint256 notional = uint256(o.margin) * o.leverage;
            if (o.isLong) { longNotional[o.market] += notional; require(longNotional[o.market] <= m.sideCap, "long cap"); }
            else { shortNotional[o.market] += notional; require(shortNotional[o.market] <= m.sideCap, "short cap"); }
            positionId = nextPosition++;
            positions[positionId] = Position(o.user, o.market, o.leverage, o.isLong, m.bustBufferBps, o.margin, uint64(block.timestamp), value, m.impact);
            pendingOpenCount--; pendingOpens[o.market]--; openCount++;
            emit Opened(positionId, o.user, o.market, value, o.margin, o.leverage);
        } else {
            closeOrder[o.positionId] = 0; _settle(o.positionId, value, false);
        }
    }
    function liquidate(uint256 id) external nonReentrant {
        Position memory p = positions[id]; require(p.user != address(0), "position");
        uint256 value = retiredPrice[p.market]; if (value == 0) (value,) = oracle.price(p.market);
        require(value > 0 && value <= 1e36, "price");
        bool adverse = p.isLong ? value < p.entry : value > p.entry; require(adverse, "healthy");
        uint256 distance = value > p.entry ? value - p.entry : p.entry - value;
        uint256 loss = Math.mulDiv(uint256(p.margin) * p.leverage, distance, p.entry);
        uint256 buffer = uint256(p.margin) * p.leverage * p.bustBufferBps / 10_000;
        require(loss + buffer >= p.margin, "healthy");
        uint256 pending = closeOrder[id]; if (pending != 0) _cancel(pending);
        _settle(id, value, true);
    }
    function _credit(address user, uint256 amount) private { balances[user] += amount; totalBalances += amount; }
    function _accrueFee(uint256 amount) private { uint256 s = amount / 2; stakerFees += s; developerFees += amount - s; }
    function _payOrQueue(address user, uint256 amount) private {
        uint256 paid = totalQueued == 0 ? Math.min(houseCash, amount) : 0;
        houseCash -= paid; _credit(user, paid); amount -= paid;
        if (amount != 0) {
            uint256 id = queueTail++; claims[id] = Claim(user, amount); queued[user] += amount; totalQueued += amount;
            emit Queued(id, user, amount);
        }
    }
    function _settle(uint256 id, uint256 value, bool liquidation) private {
        Position memory p = positions[id]; require(p.user != address(0), "position"); delete positions[id];
        uint256 notional = uint256(p.margin) * p.leverage;
        if (p.isLong) longNotional[p.market] -= notional; else shortNotional[p.market] -= notional;
        lockedMargin -= p.margin; openCount--;
        int256 result = liquidation ? -int256(uint256(p.margin)) : Economics.pnl(p.entry, value, p.margin, p.leverage, p.isLong, p.impact);
        if (result <= 0) {
            uint256 loss = uint256(-result);
            _credit(p.user, uint256(p.margin) - loss);
            uint256 fee = totalQueued == 0 ? loss * 200 / 10_000 : 0;
            houseCash += loss - fee; _accrueFee(fee);
            uint256 basis = liquidation ? loss : loss - fee;
            if (basis != 0) {
                (uint256 minted, uint256 tail) = Economics.mintQuote(trackedLpWad, tailProgressWad, basis * TO_WAD, int256(flatThresholdWad), 100e18, decayScaleWad);
                tailProgressWad += tail; participation.mint(p.user, minted);
                emit ParticipationMinted(p.user, basis, minted);
            }
            trackedLpWad += int256((loss - fee) * TO_WAD);
        } else {
            uint256 profit = uint256(result); uint256 fee = profit * 200 / 10_000; uint256 net = profit - fee;
            _credit(p.user, p.margin);
            bool payableFee = totalQueued == 0 && houseCash >= profit;
            if (payableFee) { houseCash -= fee; _accrueFee(fee); }
            _payOrQueue(p.user, net);
            trackedLpWad -= int256((net + (payableFee ? fee : 0)) * TO_WAD);
        }
        emit Closed(id, p.user, result, liquidation);
    }
    function harvest(uint256 maxEntries) external nonReentrant {
        require(maxEntries > 0 && maxEntries <= 100, "bounded batch");
        uint256 walked;
        while (queueHead < queueTail && houseCash > 0 && walked < maxEntries) {
            Claim storage c = claims[queueHead]; uint256 paid = Math.min(c.amount, houseCash);
            c.amount -= paid; houseCash -= paid; totalQueued -= paid; queued[c.user] -= paid; _credit(c.user, paid);
            emit Harvested(queueHead, c.user, paid);
            if (c.amount == 0) { delete claims[queueHead]; queueHead++; } walked++;
        }
    }
    function pushFees() external nonReentrant {
        require(totalQueued == 0, "queued claims first");
        uint256 s = stakerFees; uint256 d = developerFees; stakerFees = 0; developerFees = 0;
        if (s != 0) { collateral.safeTransfer(address(staking), s); staking.notifyReward(s); }
        if (d != 0) collateral.safeTransfer(developer, d);
        emit FeesPushed(s, d);
    }
    function sweepSurplus() external nonReentrant {
        require(totalQueued == 0 && openCount == 0 && pendingOpenCount == 0 && houseCash > houseCap, "no free surplus");
        uint256 amount = houseCash - houseCap; houseCash = houseCap;
        trackedLpWad -= int256(amount * TO_WAD); // Ratchet deliberately remains unchanged.
        collateral.safeTransfer(address(staking), amount); staking.notifyReward(amount);
        emit FeesPushed(amount, 0);
    }
    function accountedAssets() public view returns (uint256) { return totalBalances + lockedMargin + houseCash + stakerFees + developerFees; }
    function cashInvariant() external view returns (bool) { return collateral.balanceOf(address(this)) >= accountedAssets(); }
}
