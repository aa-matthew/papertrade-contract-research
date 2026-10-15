import {readFile,writeFile} from 'node:fs/promises';
import {Interface,AbiCoder} from 'ethers';
import assert from 'node:assert/strict';
const root=new URL('../../',import.meta.url);
const endpoint=process.env.LOCAL_RPC_URL??'http://127.0.0.1:8545';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname))throw Error('Local fork only');
async function rpc(method,params){const x=await(await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})})).json();return x.error?{error:x.error}:x.result;}
assert.equal(await rpc('eth_chainId',[]),'0x7a69');
const original=(await readFile(new URL('upstream/contracts/Exchange/runtime.hex',root),'utf8')).trim();
const compiled=JSON.parse(await readFile(new URL('reverse-engineered/build/compilation.json',root),'utf8'));
const reconstructed='0x'+compiled.contracts['reverse-engineered/admin/ProtocolProxy.reconstructed.sol'].ProtocolProxyReconstructed.evm.deployedBytecode.object;
const proxy='0x000000000000000000000000000000000000a111',admin='0x000000000000000000000000000000000000a222',other='0x000000000000000000000000000000000000a333',impl='0x000000000000000000000000000000000000a444',fail='0x000000000000000000000000000000000000a555';
const impSlot='0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',admSlot='0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103';
const word=x=>'0x'+x.slice(2).padStart(64,'0');
const iface=new Interface(['function implementation() view returns(address)','function admin() view returns(address)','function changeAdmin(address)','function upgradeToAndCall(address,bytes) payable']);
const vectors=[
 ['implementation by admin',admin,iface.encodeFunctionData('implementation')],
 ['implementation by nonadmin',other,iface.encodeFunctionData('implementation')],
 ['admin by admin',admin,iface.encodeFunctionData('admin')],
 ['admin by nonadmin',other,iface.encodeFunctionData('admin')],
 ['change admin',admin,iface.encodeFunctionData('changeAdmin',[other])],
 ['change admin to zero',admin,iface.encodeFunctionData('changeAdmin',['0x'+'0'.repeat(40)])],
 ['unauthorized change admin',other,iface.encodeFunctionData('changeAdmin',[other])],
 ['upgrade to EOA without code',admin,iface.encodeFunctionData('upgradeToAndCall',[other,'0x'])],
 ['upgrade to zero',admin,iface.encodeFunctionData('upgradeToAndCall',['0x'+'0'.repeat(40),'0x'])],
 ['upgrade with successful delegatecall',admin,iface.encodeFunctionData('upgradeToAndCall',[impl,'0x01020304'])],
 ['upgrade with reverting delegatecall',admin,iface.encodeFunctionData('upgradeToAndCall',[fail,'0x01020304'])],
 ['unauthorized upgrade',other,iface.encodeFunctionData('upgradeToAndCall',[impl,'0x'])],
 ['ordinary user fallback',other,'0x01020304'],
 ['admin fallback also delegates',admin,'0x01020304'],
 ['empty calldata delegates',other,'0x'],
 ['nonpayable getter rejects value',admin,iface.encodeFunctionData('implementation'),'0x1'],
 ['payable upgrade accepts value',admin,iface.encodeFunctionData('upgradeToAndCall',[impl,'0x']),'0x1'],
];
async function observe(code,from,data,value){
 const overrides={
  [proxy]:{code,stateDiff:{[impSlot]:word(impl),[admSlot]:word(admin)}},
  [impl]:{code:'0x602a60005260206000f3'},
  [fail]:{code:'0x63deadbeef6000526004601cfd'},
  [admin]:{balance:'0x1000000000000000000'},
  [other]:{balance:'0x1000000000000000000'},
 };
 const call={to:proxy,from,data,...(value?{value}:{})};
 const out=await rpc('eth_call',[call,'latest',overrides]);
 const trace=await rpc('debug_traceCall',[call,'latest',{disableMemory:true,disableStorage:true,stateOverrides:overrides}]);
 assert.ok(Array.isArray(trace.structLogs),'Missing local execution trace');
 const writes=(trace.structLogs??[]).filter(x=>x.op==='SSTORE').map(x=>({slot:x.stack.at(-1),value:x.stack.at(-2)}));
 return {success:typeof out==='string',output:typeof out==='string'?out:out.error?.data??null,writes};
}
const tests=[];
for(const [name,from,data,value]of vectors){
 const a=await observe(original,from,data,value),b=await observe(reconstructed,from,data,value);
 const pass=JSON.stringify(a)===JSON.stringify(b);tests.push({name,pass,original:a,reconstructed:b});console.log(pass?'PASS':'FAIL',name);
}
await writeFile(new URL('proxy-verification.json',import.meta.url),JSON.stringify({method:'read-only eth_call and debug_traceCall with ephemeral stateOverrides',scope:'Selected runtime branches only; no constructor, malformed-calldata, gas or bytecode equivalence claim',tests},null,2)+'\n');
if(tests.some(x=>!x.pass))process.exitCode=1;
