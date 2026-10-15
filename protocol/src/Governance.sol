// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// Self-administered timelock: no separate bootstrap administrator remains.
contract ProtocolTimelock is TimelockController {
    constructor(uint256 delay, address governor)
        TimelockController(delay, _one(governor), _one(governor), address(0))
    { require(delay >= 1 days && governor != address(0), "governance config"); }
    function updateDelay(uint256 newDelay) public override {
        require(newDelay >= 1 days, "minimum delay");
        super.updateDelay(newDelay);
    }
    function _one(address value) private pure returns (address[] memory a) { a = new address[](1); a[0] = value; }
}
