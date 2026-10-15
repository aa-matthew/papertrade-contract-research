// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// Behavioral reconstruction, NOT original Solidity or bytecode-equivalent.
/// Established runtime storage/gates; initializer nested-call behavior is partial.
/// Unknown public selectors are retained through fallback using neutral names.
contract PaperTokenReconstructed {
    uint8 private initialized;       // slot0 byte0
    bool private initializing;      // slot0 byte1
    string public name;             // slot1
    string public symbol;           // slot2
    address public owner;           // slot3
    address public minter;          // slot4
    address private privilegedSpender; // slot5; deployed equal to staking, distinct role
    uint256 public totalSupply;     // slot6
    mapping(address => uint256) public balanceOf; // slot7
    mapping(address => mapping(address => uint256)) private approvals; // slot8
    address public stakingContract; // slot9

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

    function fail(bytes4 selector) private pure {
        assembly { mstore(0, selector) revert(0, 4) }
    }
    modifier onlyOwner() {
        if (msg.sender != owner) fail(0x30cd7471);
        _;
    }
    modifier onlyMinter() {
        if (msg.sender != minter) fail(0xf8d2906c);
        _;
    }
    function decimals() external pure returns (uint8) { return 18; }

    /// Simple one-shot initialization branch reconstructed. Nested initialization
    /// semantics of the archived runtime are explicitly not fully reproduced.
    function initialize(string calldata n, string calldata s, address o, address m) external {
        require(initialized == 0 && !initializing, "partial initializer: already initialized");
        initialized = 1;
        initializing = true;
        name = n;
        symbol = s;
        owner = o;
        minter = m;
        roleLog(0x4ffd725fc4a22075e9ec71c59edf9c38cdeb588a91b24fc5b61388c5be41282b, o);
        roleLog(0xad0f299ec81a386c98df0ac27dae11dd020ed1b56963c53a7292e7a3a314539a, m);
        initializing = false;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        approvals[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    function allowance(address holder, address spender) external view returns (uint256) {
        return spender == privilegedSpender ? type(uint256).max : approvals[holder][spender];
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        restrictedTransfer(msg.sender, to, amount);
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (msg.sender != privilegedSpender) {
            uint256 available = approvals[from][msg.sender];
            if (available < amount) fail(0x13be252b);
            approvals[from][msg.sender] = available - amount;
        }
        restrictedTransfer(from, to, amount);
        return true;
    }
    function restrictedTransfer(address from, address to, uint256 amount) private {
        address staking = stakingContract;
        if (staking == address(0) || msg.sender != staking || (from != staking && to != staking)) {
            fail(0xe827105e);
        }
        if (balanceOf[from] < amount) fail(0xf4d678b8);
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
    function mint(address to, uint256 amount) external onlyMinter {
        totalSupply += amount;
        balanceOf[to] += amount;
        emit Transfer(address(0), to, amount);
    }
    function burn(address from, uint256 amount) external onlyMinter {
        if (balanceOf[from] < amount) fail(0xf4d678b8);
        balanceOf[from] -= amount;
        totalSupply -= amount;
        emit Transfer(from, address(0), amount);
    }
    function setMinter(address next) external onlyOwner {
        minter = next;
        roleLog(0xad0f299ec81a386c98df0ac27dae11dd020ed1b56963c53a7292e7a3a314539a, next);
    }
    function transferOwnership(address next) external onlyOwner {
        owner = next;
        roleLog(0x4ffd725fc4a22075e9ec71c59edf9c38cdeb588a91b24fc5b61388c5be41282b, next);
    }
    function setStakingContract(address next) external onlyOwner {
        stakingContract = next;
        roleLog(0x6397f5b135542bb3f477cb346cfab5abdec1251d08dc8f8d4efb4ffe122ea0bf, next);
    }
    function roleLog(bytes32 topic, address value) private {
        assembly { log2(0, 0, topic, value) }
    }
    fallback() external {
        if (msg.sig == 0x12bbf044) {
            address result = privilegedSpender;
            assembly { mstore(0, result) return(0, 32) }
        }
        if (msg.sig == 0xd311b1a9) {
            if (msg.sender != owner) fail(0x30cd7471);
            address next = abi.decode(msg.data[4:], (address));
            privilegedSpender = next;
            roleLog(0x6e54fcdf080b1c188bfc8f26eb9386e78b6cb5428459a86cdd74357de82a33ae, next);
            return;
        }
        assembly { revert(0, 0) }
    }
}
