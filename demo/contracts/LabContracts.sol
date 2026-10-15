// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
import {Exchange} from "../../protocol/src/Exchange.sol";
import {IExecutionOracle, IProtocolToken, IRewardSink} from "../../protocol/src/Interfaces.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {SettlementMathReconstructed} from "../../reverse-engineered/settlement/SettlementMath.reconstructed.sol";
import {MintCurveReconstructed} from "../../reverse-engineered/token/MintCurve.reconstructed.sol";

/// Local-only executable reconstruction. Custody/auth/queue are our v0.1 implementation;
/// PnL and mint math execute the actual reconstructed research Solidity above.
contract ReconstructedLabExchange is Exchange {
    constructor(address governor, address guardian_, address developer_, IERC20 cash, IExecutionOracle feed, IProtocolToken token, IRewardSink rewards)
        Exchange(governor, guardian_, developer_, cash, feed, token, rewards) { require(block.chainid == 31337, "lab only"); }
    function _positionPnl(Position memory p, uint256 value) internal pure override returns (int256 adjusted) {
        require(p.entry % 1e10 == 0 && value % 1e10 == 0 && p.entry / 1e10 <= type(uint64).max && value / 1e10 <= type(uint64).max, "8 decimal research prices");
        (, adjusted) = SettlementMathReconstructed.pnl(uint64(p.entry / 1e10), uint64(value / 1e10), p.margin, p.leverage, p.isLong,
            p.impact.base, p.impact.rate, p.impact.position, p.impact.referenceUsd);
    }
    function _lossMintQuote(uint256 basis) internal view override returns (uint256, uint256) {
        return MintCurveReconstructed.quote(trackedLpWad, tailProgressWad, basis * TO_WAD, int256(flatThresholdWad), 100e18, decayScaleWad);
    }
    function reconstruction() external pure returns (string memory) { return "Recovered SettlementMath + MintCurve; original v0.1 custody/auth/queue; local-only"; }
}
contract LabCollateral is ERC20, Ownable {
    constructor(address treasury) ERC20("Lab Dollar - no real value", "LABUSD") Ownable(treasury) { require(block.chainid == 31337, "lab only"); }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address user, uint256 amount) external onlyOwner { _mint(user, amount); }
}
contract LabOracle is IExecutionOracle, Ownable {
    struct Quote { uint192 value; uint64 at; }
    mapping(uint32 => Quote) public quotes;
    address public immutable operator;
    address public immutable guardian;
    bool public paused;
    event QuotePublished(uint32 indexed market, uint256 price, uint64 at);
    event OraclePaused(bool paused);
    constructor(address governor,address operator_,address guardian_) Ownable(governor) {
        require(block.chainid == 31337, "lab only"); operator=operator_; guardian=guardian_;
    }
    function publish(uint32 market,uint192 value) external {
        require(msg.sender==operator,"oracle operator only");
        require(value>0 && value%1e10==0 && value/1e10<=type(uint64).max,"price precision/range");
        quotes[market]=Quote(value,uint64(block.timestamp)); emit QuotePublished(market,value,uint64(block.timestamp));
    }
    function setPaused(bool flag) external {
        require(msg.sender==owner()||(msg.sender==guardian&&flag),"oracle authority"); paused=flag; emit OraclePaused(flag);
    }
    function price(uint32 market) external view returns(uint256,uint64) {
        require(!paused,"oracle paused"); Quote memory q=quotes[market]; require(q.at>0&&block.timestamp-q.at<=30,"oracle stale");return(q.value,q.at);
    }
}
