// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
// ANALYST RECONSTRUCTION: core read path only, not original source.
// Proxy, ownership, initialization, mark/oracle read methods and batch omitted.
contract PriceOracleReadReconstruction {
    function getBBO(uint32 asset) public view returns (uint64 bid,uint64 ask) {
        (bool ok,bytes memory out)=address(0x080e).staticcall(abi.encode(asset));
        require(ok && out.length>=64,"BBO read failed");
        (bid,ask)=abi.decode(out,(uint64,uint64));
    }
    // Input signature recovered by selector hash; original return width unresolved.
    function getExecutionPrice(uint32 asset) external view returns(uint64) {
        (uint64 bid,uint64 ask)=getBBO(asset);
        require(bid!=0 && ask!=0,"BBO unavailable");
        require(bid<=ask,"BBO crossed");
        uint64 p=uint64((uint256(bid)+uint256(ask))/2);
        require(p!=0,"Execution price is zero");
        return p;
    }
}
