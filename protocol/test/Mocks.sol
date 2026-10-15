// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IExecutionOracle} from "../src/Interfaces.sol";

contract MockCollateral is ERC20 {
    constructor() ERC20("TEST collateral", "TESTUSD") { require(block.chainid == 31337 || block.chainid == 1337, "local only"); }
    function decimals() public pure override returns (uint8) { return 6; }
    function mint(address user, uint256 amount) external { _mint(user, amount); }
}
contract MockOracle is IExecutionOracle {
    uint256 public value = 80_000e18;
    uint64 public at;
    constructor() { require(block.chainid == 31337 || block.chainid == 1337, "local only"); }
    function set(uint256 value_, uint64 at_) external { value = value_; at = at_; }
    function price(uint32) external view returns (uint256, uint64) { require(at > 0 && block.timestamp - at <= 30, "stale"); return (value, at); }
}
contract MockVerifier {
    bool public reject;
    constructor() { require(block.chainid == 31337 || block.chainid == 1337, "local only"); }
    function setReject(bool flag) external { reject = flag; }
    function verify(bytes calldata report, bytes calldata) external payable returns (bytes memory) { require(!reject, "invalid proof"); return report; }
}
contract MockSequencer {
    int256 public status;
    uint256 public startedAt = 1;
    function set(int256 status_, uint256 started_) external { status = status_; startedAt = started_; }
    function latestRoundData() external view returns(uint80, int256, uint256, uint256, uint80) { return (1, status, startedAt, block.timestamp, 1); }
}

import {Economics} from "../src/Economics.sol";
contract EconomicsHarness {
    function mintQuote(int256 lp, uint256 progress, uint256 basis) external pure returns (uint256,uint256) {
        return Economics.mintQuote(lp,progress,basis,2_000_000e18,100e18,120_000_000e18);
    }
}
