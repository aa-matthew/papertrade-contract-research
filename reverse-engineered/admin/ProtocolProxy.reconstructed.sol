// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;

/// @notice Agent reconstruction from the 925-byte archived protocol proxy runtime.
/// Not original source and not a bytecode-equivalence claim. Error names are
/// unknown: their observed selectors are deliberately preserved as raw bytes.
contract ProtocolProxyReconstructed {
    bytes32 private constant IMPLEMENTATION_SLOT =
        0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 private constant ADMIN_SLOT =
        0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    constructor(address implementation_, address admin_, bytes memory initialization) payable {
        // Constructor behavior is a local convenience; evidence for this file's
        // reconstruction covers deployed runtime, not original creation code.
        require(implementation_ != address(0) && admin_ != address(0));
        assembly { sstore(IMPLEMENTATION_SLOT, implementation_) sstore(ADMIN_SLOT, admin_) }
        if (initialization.length != 0) _initialize(implementation_, initialization);
    }

    function implementation() external view returns (address result) {
        _onlyAdmin();
        assembly { result := sload(IMPLEMENTATION_SLOT) }
    }

    function admin() external view returns (address result) {
        _onlyAdmin();
        assembly { result := sload(ADMIN_SLOT) }
    }

    function changeAdmin(address next) external {
        _onlyAdmin();
        if (next == address(0)) _invalidAddress();
        assembly { sstore(ADMIN_SLOT, next) }
    }

    function upgradeToAndCall(address next, bytes calldata initialization) external payable {
        _onlyAdmin();
        if (next == address(0)) _invalidAddress();
        // The runtime checks zero address, not EXTCODESIZE of the new address.
        assembly { sstore(IMPLEMENTATION_SLOT, next) }
        if (initialization.length != 0) _initialize(next, initialization);
    }

    function _initialize(address target, bytes memory data) private {
        (bool success, bytes memory returned) = target.delegatecall(data);
        if (!success) {
            bytes memory failure = abi.encodeWithSelector(bytes4(0x23615171), returned);
            assembly { revert(add(failure, 32), mload(failure)) }
        }
    }

    function _onlyAdmin() private view {
        address allowed;
        assembly { allowed := sload(ADMIN_SLOT) }
        if (msg.sender != allowed) {
            assembly { mstore(0, shl(224, 0x7bfa4b9f)) revert(0, 4) }
        }
    }

    function _invalidAddress() private pure {
        assembly { mstore(0, shl(224, 0xe6c4247b)) revert(0, 4) }
    }

    fallback() external payable { _delegate(); }
    receive() external payable { _delegate(); }

    function _delegate() private {
        assembly {
            let target := sload(IMPLEMENTATION_SLOT)
            calldatacopy(0, 0, calldatasize())
            let success := delegatecall(gas(), target, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch success
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
