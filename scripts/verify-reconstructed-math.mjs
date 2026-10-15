import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Interface,AbiCoder} from 'ethers';
const root=path.resolve(import.meta.dirname,'..');
const load=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const compilation=await load('reverse-engineered/build/compilation.json');
const artifact=compilation.contracts['reverse-engineered/harness/ResearchMathHarness.sol'].ResearchMathHarness;
const iface=new Interface(artifact.abi),runtime='0x'+artifact.evm.deployedBytecode.object;
const endpoint=process.env.LOCAL_RPC_URL??'http://127.0.0.1:8545';
if(!['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname))throw Error('Loopback required');
async function rpc(method,params){const x=await(await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})})).json();if(x.error)throw Error(JSON.stringify(x.error));return x.result;}
assert.equal(await rpc('eth_chainId',[]),'0x7a69');
const target='0x000000000000000000000000000000000000a777',coder=AbiCoder.defaultAbiCoder();
const tests=[];
async function compare(kind,originalAddress,selector,types,args){
 const originalData=selector+coder.encode(types,args).slice(2);
 const a=await rpc('eth_call',[{to:originalAddress,data:originalData},'latest']);
 const b=await rpc('eth_call',[{to:target,data:iface.encodeFunctionData(kind,args)},'latest',{[target]:{code:runtime}}]);
 const pass=a===b;tests.push({kind,selector,args:args.map(String),pass,original:a,reconstructed:b});
 if(!pass)console.error('FAIL',kind,args.map(String));
}
const mint=(await load('reverse-engineered/token/verification.json')).results.filter(x=>x.name.startsWith('Library quote'));
for(const v of mint)await compare('quote','0xe991817199363046da0a28da6fbad0284e4aa492','0x7aac24ba',['int256','uint256','uint256','int256','uint256','uint256'],v.evidence.args.map(BigInt));
const haircut=(await load('reverse-engineered/settlement/haircut-tests.json')).tests;
for(const v of haircut)await compare('retainedProfit','0xcd617f984158a4f5d287ddee0e8eb0fed204916d','0xb67f3dd7',['uint256','uint64','uint64','uint256','uint256','uint256','uint256'],v.args.map(BigInt));
const pnl=(await load('reverse-engineered/settlement/pnl-tests.json')).tests;
for(const v of pnl)await compare('pnl','0xcd617f984158a4f5d287ddee0e8eb0fed204916d','0x82296364',['uint64','uint64','uint128','uint32','bool','uint256','uint256','uint256','uint256'],v.args.map((x,i)=>i===4?x==='true':BigInt(x)));
await writeFile(path.join(root,'reverse-engineered/math-verification.json'),JSON.stringify({method:'Read-only eth_call with ephemeral runtime override for compiled reconstructed helper',compiler:compilation.compiler,scope:'Selected normal-range inputs, not all integer overflow or ABI behavior',tests},null,2)+'\n');
console.log(`${tests.filter(x=>x.pass).length}/${tests.length} compiled math differential vectors passed`);
if(tests.some(x=>!x.pass))process.exitCode=1;
