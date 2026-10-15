// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IExecutionOracle} from "./Interfaces.sol";

interface IReportVerifier { function verify(bytes calldata payload, bytes calldata feeParameters) external payable returns (bytes memory); }
interface ISequencerFeed { function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80); }

/// Chainlink Data Streams Crypto Advanced v3 adapter. Addresses/feed IDs are
/// operator inputs: this contract does not assume a deployment address exists.
contract StreamOracle is Ownable, ReentrancyGuard, IExecutionOracle {
    struct Report {
        bytes32 feedId; uint32 validFrom; uint32 observation; uint192 nativeFee;
        uint192 linkFee; uint32 expiresAt; int192 mid; int192 bid; int192 ask;
    }
    struct Feed { bytes32 id; uint32 maxAge; uint16 maxSpreadBps; uint8 decimals; uint192 minPrice; uint192 maxPrice; }
    struct Observation { uint192 value; uint64 at; uint32 expiresAt; }
    IReportVerifier public immutable verifier;
    ISequencerFeed public immutable sequencer;
    uint32 public immutable recoveryGrace;
    address public guardian;
    bool public paused = true;
    mapping(uint32 => Feed) public feeds;
    mapping(uint32 => Observation) public latest;
    event PriceUpdated(uint32 indexed market, uint256 price, uint64 observation);
    event FeedConfigured(uint32 indexed market, bytes32 feed);
    event PauseChanged(bool paused);

    constructor(address owner_, address guardian_, address verifier_, address sequencer_, uint32 grace_) Ownable(owner_) {
        require(verifier_.code.length > 0 && guardian_ != address(0), "configuration");
        require(sequencer_ == address(0) || sequencer_.code.length > 0, "sequencer contract");
        verifier = IReportVerifier(verifier_); sequencer = ISequencerFeed(sequencer_);
        guardian = guardian_; recoveryGrace = grace_;
    }
    function configure(uint32 market, Feed calldata f) external onlyOwner {
        require(feeds[market].id == bytes32(0), "feed immutable; new market required");
        require(f.id != bytes32(0) && uint16(bytes2(f.id)) == 3, "v3 feed required");
        require(f.maxAge > 0 && f.maxAge <= 30 && f.maxSpreadBps <= 500 && (f.decimals == 8 || f.decimals == 18), "limits");
        require(f.minPrice > 0 && f.maxPrice > f.minPrice && f.maxPrice <= 1e36, "price bounds");
        feeds[market] = f; emit FeedConfigured(market, f.id);
    }
    function setPaused(bool flag) external {
        require(msg.sender == owner() || (msg.sender == guardian && flag), "authority");
        paused = flag; emit PauseChanged(flag);
    }
    function setGuardian(address next) external onlyOwner { require(next != address(0), "zero"); guardian = next; }
    function _healthy() private view {
        require(!paused, "oracle paused");
        if (address(sequencer) != address(0)) {
            (, int256 status, uint256 startedAt, uint256 updatedAt,) = sequencer.latestRoundData();
            require(status == 0 && startedAt > 0 && updatedAt > 0 && updatedAt <= block.timestamp, "sequencer down");
            require(block.timestamp > startedAt && block.timestamp - startedAt > recoveryGrace, "recovery grace");
        }
    }
    function update(uint32 market, bytes calldata payload, bytes calldata feeParameters) external payable nonReentrant {
        _healthy(); Feed memory f = feeds[market]; require(f.id != bytes32(0), "unknown feed");
        bytes memory verified = verifier.verify{value: msg.value}(payload, feeParameters);
        Report memory r = abi.decode(verified, (Report));
        require(r.feedId == f.id && r.validFrom <= r.observation && r.observation <= block.timestamp, "report identity/time");
        require(r.expiresAt >= block.timestamp && block.timestamp - r.observation <= f.maxAge, "stale report");
        require(r.mid > 0 && r.bid > 0 && r.bid <= r.mid && r.mid <= r.ask, "invalid quote");
        uint256 raw = uint256(uint192(r.mid));
        uint256 value = raw * (10 ** (18 - f.decimals));
        require(value >= f.minPrice && value <= f.maxPrice, "out of bounds");
        require(uint256(uint192(r.ask - r.bid)) * 10_000 <= raw * f.maxSpreadBps, "wide spread");
        Observation memory previous = latest[market];
        require(r.observation > previous.at || (r.observation == previous.at && value == previous.value), "old/conflicting report");
        latest[market] = Observation(uint192(value), r.observation, r.expiresAt);
        emit PriceUpdated(market, value, r.observation);
    }
    function price(uint32 market) external view returns (uint256 value, uint64 at) {
        _healthy(); Feed memory f = feeds[market]; Observation memory o = latest[market];
        require(o.at != 0 && o.at <= block.timestamp && block.timestamp - o.at <= f.maxAge && block.timestamp <= o.expiresAt, "price stale");
        return (o.value, o.at);
    }
}
