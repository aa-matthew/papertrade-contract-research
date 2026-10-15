// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.24;
// ANALYST BEHAVIORAL HARNESS, not original source. Exact recovered storage slots,
// core signature/nonce/session paths; analyst constructor replaces proxy initializer.
// Unknown function names are exposed through their observed selectors in fallback.
contract SessionKeyManagerReconstruction {
    uint16 private initializationFlags;                                      // slot 0
    bytes32 public DOMAIN_SEPARATOR;                                        // slot 1
    address public owner;                                                   // slot 2
    address public authorizedCaller;                                        // slot 3
    struct Session { uint64 expiry; address feeAddress; }
    mapping(address=>mapping(address=>Session)) public sessionKeys;          // slot 4
    mapping(address=>uint256) public nonces;                                 // slot 5
    mapping(address=>mapping(uint256=>uint256)) internal nonceBitmap;         // slot 6
    mapping(address=>bool) public authorizedSubmitters;                      // slot 7
    bytes32 private constant REGISTER_TYPEHASH=keccak256("RegisterSessionKey(address user,address key,uint64 expiry,address feeAddress,uint256 nonce,uint64 deadline)");
    bytes32 private constant DOMAIN_TYPEHASH=keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");
    // Harness constructor is an explicit design choice, not recovered original ABI.
    constructor(address initialOwner,address caller){initializationFlags=1;owner=initialOwner;authorizedCaller=caller;DOMAIN_SEPARATOR=domainSeparatorV4();}
    function domainSeparatorV4() public view returns(bytes32){return keccak256(abi.encode(DOMAIN_TYPEHASH,keccak256("String"),keccak256("1"),block.chainid,authorizedCaller));}
    function isNonceUsed(address user,uint256 nonce) public view returns(bool){return nonceBitmap[user][nonce>>8]&(uint256(1)<<(nonce&255))!=0;}
    function consume(address user,uint256 nonce) internal {
        uint256 word=nonce>>8;uint256 bit=uint256(1)<<(nonce&255);
        if(nonceBitmap[user][word]&bit!=0)fail(0x756688fe);
        nonceBitmap[user][word]|=bit;
        if(nonce>=nonces[user])nonces[user]=nonce+1;
    }
    function registerSessionKeyBySig(address user,address key,uint64 expiry,address feeAddress,uint256 nonce,uint64 deadline,uint8 v,bytes32 r,bytes32 s) external {
        if(!authorizedSubmitters[msg.sender])fail(0x93b78c88);
        if(key==address(0))fail(0x276f9a65);
        if(block.timestamp>deadline)fail(0xf87d9271);
        consume(user,nonce);
        bytes32 structHash=keccak256(abi.encode(REGISTER_TYPEHASH,user,key,expiry,feeAddress,nonce,deadline));
        address signer=recoverSigner(digest(structHash),v,r,s);
        if(signer==address(0)||signer!=user)fail(0x8baa579f);
        // Match packed update including preserved unused high 32 bits.
        bytes32 recordSlot=keccak256(abi.encode(key,keccak256(abi.encode(user,uint256(4)))));
        assembly {sstore(recordSlot,or(and(sload(recordSlot),shl(224,0xffffffff)),or(expiry,shl(64,feeAddress))))}
        bytes32 topic=0x3cec0566535d67d6c92668517af0bf8a66cdc91d622dbb830fcc08e1bcf5d1df;
        bytes memory eventData=abi.encode(expiry,feeAddress);
        assembly {log3(add(eventData,32),64,topic,user,key)}
    }
    function revokeSessionKey(address key) external {
        bytes32 recordSlot=keccak256(abi.encode(key,keccak256(abi.encode(msg.sender,uint256(4)))));
        assembly {sstore(recordSlot,0)}
        bytes32 topic=0x744157ccffbd293a2e8644928cd7d23d650f869b88f72d7bfea8041b76ca6bec;
        assembly {log3(0,0,topic,caller(),key)}
    }
    function consumeIntent(address user,uint256 nonce,uint64 deadline) internal {
        if(msg.sender!=authorizedCaller)fail(0x5c427cd9);
        if(block.timestamp>deadline)fail(0xf87d9271);
        consume(user,nonce);
    }
    function recoverSession(address user,bytes32 structHash,uint8 v,bytes32 r,bytes32 s) internal view returns(uint64 expiry){
        address key=recoverSigner(digest(structHash),v,r,s);
        expiry=sessionKeys[user][key].expiry;
        if(expiry==0)fail(0xc5045f22);
        if(block.timestamp>expiry)fail(0xda0700a2);
    }
    function recoverSigner(bytes32 hash,uint8 v,bytes32 r,bytes32 s) public pure returns(address){
        if((v!=27&&v!=28)||uint256(s)>0x7fffffffffffffffffffffffffffffff5d576e7357a4501ddfe92f46681b20a0)return address(0);
        return ecrecover(hash,v,r,s);
    }
    function digest(bytes32 h) internal view returns(bytes32){return keccak256(abi.encodePacked(hex"1901",domainSeparatorV4(),h));}
    function setAuthorizedSubmitter(address who,bool yes) external {if(msg.sender!=owner)fail(0x30cd7471);authorizedSubmitters[who]=yes;/* admin event omitted */}
    function setAuthorizedCaller(address who) external {if(msg.sender!=owner)fail(0x30cd7471);authorizedCaller=who;/* admin event omitted */}
    function transferOwnership(address who) external {if(msg.sender!=owner)fail(0x30cd7471);owner=who;/* admin event omitted */}
    fallback(bytes calldata input) external returns(bytes memory){
        if(msg.sig==0xb002b9fa){(address u,uint256 n,uint64 d)=abi.decode(input[4:],(address,uint256,uint64));consumeIntent(u,n,d);return bytes("");}
        if(msg.sig==0x7f608253){(address u,bytes32 h,uint8 v,bytes32 r,bytes32 s)=abi.decode(input[4:],(address,bytes32,uint8,bytes32,bytes32));return abi.encode(recoverSession(u,h,v,r,s));}
        revert("unreconstructed selector");
    }
    function fail(bytes4 selector) internal pure {assembly {mstore(0,selector) revert(0,4)}}
}
