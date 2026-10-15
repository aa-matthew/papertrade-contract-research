// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// Original implementation. Loss-minted participation token; no redemption promise.
contract ProtocolToken is ERC20, Ownable {
    address public exchange;
    address public staking;
    error RestrictedTransfer();
    constructor(address owner_) ERC20("Protocol Participation", "PART") Ownable(owner_) {}
    function wire(address exchange_, address staking_) external onlyOwner {
        require(exchange == address(0) && exchange_.code.length > 0 && staking_.code.length > 0, "wire once");
        exchange = exchange_; staking = staking_;
    }
    function mint(address user, uint256 amount) external {
        require(msg.sender == exchange, "exchange only");
        _mint(user, amount);
    }
    function _update(address from, address to, uint256 amount) internal override {
        if (from != address(0) && to != address(0)
            && (msg.sender != staking || (from != staking && to != staking))) revert RestrictedTransfer();
        super._update(from, to, amount);
    }
}
