// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
// ANALYST RECONSTRUCTION, not original source or a deployable drop-in replacement.
// Names below are analyst labels except execute(), whose input signature hashes
// exactly to archived selector 0x251fb27d. Storage/initializers/events omitted.
abstract contract BatchExecutorReconstruction {
    struct Call {
        address target;
        bytes data;
        bool allowFailure;
        bytes32 failureGroup; // inferred semantics, original field name unknown
        bytes32 itemId;       // inferred semantics, original field name unknown
    }
    mapping(address => bool) internal authorizedRelayers;
    address internal exchange;
    address internal sessionKeyManager;
    address internal paperStaking;

    function execute(Call[] calldata calls) external {
        require(authorizedRelayers[msg.sender], "reconstructed unauthorized");
        bytes32[] memory failedGroups = new bytes32[](calls.length);
        uint256 count;
        // Actual implementation hashes complete msg.data for event correlation.
        bytes32 batchId = keccak256(msg.data);
        for (uint256 i; i < calls.length; ++i) {
            Call calldata c = calls[i];
            if (c.failureGroup != bytes32(0) && contains(failedGroups,count,c.failureGroup)) {
                recordSkipped(batchId,i,c.itemId,c.failureGroup);
                continue;
            }
            bytes memory reason;
            bool ok;
            if (c.data.length < 4) {
                reason = abi.encodeWithSelector(bytes4(0x635a68e0),c.data.length);
            } else if (!allowed(c.target, bytes4(c.data[:4]))) {
                reason = bytes("BatchExecutor: selector not allowed");
            } else {
                (ok,reason) = c.target.call(c.data); // zero value, ordinary CALL
            }
            if (!ok) {
                if (!c.allowFailure) revertBatch(i,reason); // selector 0x651ab1b3
                if (c.failureGroup != bytes32(0)) failedGroups[count++] = c.failureGroup;
            }
            recordResult(batchId,i,c.itemId,ok,reason);
        }
        // Aggregate count/event encoding intentionally not reconstructed here.
    }
    function allowed(address target,bytes4 s) internal view returns(bool) {
        if(target==exchange) return s==0xec6783f0 || s==0x2792e706 || s==0x8d09f23f;
        if(target==sessionKeyManager) return s==0x5f76a1d6;
        if(target==paperStaking) return s==0x83115825 || s==0xfa2871b5 || s==0x9c96d4a1 || s==0xf0355460;
        return false;
    }
    function contains(bytes32[] memory a,uint256 n,bytes32 x) private pure returns(bool){for(uint256 i;i<n;++i)if(a[i]==x)return true;return false;}
    function recordSkipped(bytes32,uint256,bytes32,bytes32) internal virtual;
    function recordResult(bytes32,uint256,bytes32,bool,bytes memory) internal virtual;
    function revertBatch(uint256,bytes memory) internal virtual;
}
