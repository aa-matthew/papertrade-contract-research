// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {ICoreWriter} from "./interfaces/ICoreWriter.sol";

contract CoreWriter is ICoreWriter {
    function sendRawAction(bytes calldata data) external {
        // Spends ~20k gas
        for (uint256 i = 0; i < 400; i++) {}
        emit RawAction(msg.sender, data);
    }
}
