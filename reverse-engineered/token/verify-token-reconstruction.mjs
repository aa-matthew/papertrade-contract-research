// Differential execution through ephemeral stateOverrides; never changes fork state.
import fs from 'node:fs';
import solc from 'solc';
import assert from 'node:assert/strict';
import { AbiCoder, Interface, JsonRpcProvider, keccak256, toBeHex } from 'ethers';
const p = new JsonRpcProvider('http://127.0.0.1:8545');
assert.equal(await p.send('eth_chainId',[]),'0x7a69');
const A = JSON.parse(fs.readFileSync(new URL('../../inspection/official-addresses.json',import.meta.url)));
const compiled=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources:{'PaperToken.reconstructed.sol':{content:fs.readFileSync(new URL('./PaperToken.reconstructed.sol',import.meta.url),'utf8')}},settings:{optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.deployedBytecode.object','storageLayout']}}}})));
const artifact=compiled.contracts['PaperToken.reconstructed.sol'].PaperTokenReconstructed;
const code='0x'+artifact.evm.deployedBytecode.object;
const iface=new Interface(artifact.abi), c=AbiCoder.defaultAbiCoder(), W=10n**18n;
const user='0x0000000000000000000000000000000000000123', other='0x0000000000000000000000000000000000000456';
const owner='0x'+(await p.getStorage(A.PaperToken,3)).slice(-40), staking='0x'+(await p.getStorage(A.PaperToken,9)).slice(-40), minter='0x'+(await p.getStorage(A.PaperToken,4)).slice(-40);
const slot=(key,n)=>keccak256(c.encode(['address','uint256'],[key,n]));
const allowanceSlot=(holder,spender)=>keccak256(c.encode(['address','bytes32'],[spender,slot(holder,8)]));
const stateDiff={ [slot(user,7)]:toBeHex(W,32),[slot(staking,7)]:toBeHex(W,32),[toBeHex(6,32)]:toBeHex(2n*W,32)};
const scenarios=[];
function add(name,from,method,args=[],extra={}){scenarios.push({name,tx:{to:A.PaperToken,from,data:method.startsWith('0x')?method:iface.encodeFunctionData(method,args)},extra});}
for(const method of ['name','symbol','decimals','owner','minter','totalSupply','stakingContract'])add(method,user,method);
add('unknown getter slot5',user,'0x12bbf044');
add('approve zero address',user,'approve',['0x0000000000000000000000000000000000000000',W]);
add('approve user',user,'approve',[other,W]);
add('implicit allowance',user,'allowance',[user,staking]);
add('ordinary allowance',user,'allowance',[user,other]);
add('ordinary transfer rejected',user,'transfer',[other,W]);
add('direct stake transfer rejected',user,'transfer',[staking,W]);
add('staking transfer',staking,'transfer',[user,W]);
add('staking transfer too large',staking,'transfer',[user,2n*W]);
add('staking self transfer',staking,'transfer',[staking,W]);
add('staking pull',staking,'transferFrom',[user,staking,W]);
add('staking arbitrary user movement rejected',staking,'transferFrom',[user,other,W]);
add('unprivileged transferFrom allowance rejected',other,'transferFrom',[user,staking,W]);
add('staking finite allowance',staking,'transferFrom',[user,staking,W],{[toBeHex(5,32)]:toBeHex(BigInt(other),32),[allowanceSlot(user,staking)]:toBeHex(2n*W,32)});
add('staking max allowance decremented',staking,'transferFrom',[user,staking,W],{[toBeHex(5,32)]:toBeHex(BigInt(other),32),[allowanceSlot(user,staking)]:toBeHex((1n<<256n)-1n,32)});
add('authorized mint',minter,'mint',[user,W]);
add('mint to zero',minter,'mint',['0x0000000000000000000000000000000000000000',W]);
add('unauthorized mint',user,'mint',[user,W]);
add('authorized burn',minter,'burn',[user,W]);
add('overburn',minter,'burn',[user,2n*W]);
add('unauthorized burn',user,'burn',[user,0]);
for(const method of ['setMinter','setStakingContract','transferOwnership']){
 add(method+' owner',owner,method,[other]);add(method+' zero',owner,method,['0x0000000000000000000000000000000000000000']);add(method+' unauthorized',user,method,[other]);
}
add('privilegedSpender setter',owner,'0xd311b1a9'+c.encode(['address'],[other]).slice(2));
add('privilegedSpender setter unauthorized',user,'0xd311b1a9'+c.encode(['address'],[other]).slice(2));
add('one-shot initializer (cleared flag fixture)',user,'initialize',['Recovered','REC',user,other],{[toBeHex(0,32)]:toBeHex(0,32)});
async function observe(tx,overrides){
 let result;try{result={success:true,data:await p.send('eth_call',[tx,'latest',overrides])};}catch(e){result={success:false,data:e.data??e.info?.error?.data};}
 const tr=await p.send('debug_traceCall',[tx,'latest',{enableMemory:true,stateOverrides:overrides}]);
 // Disregard proxy depth; only the token implementation writes normal slots.
 const writes=tr.structLogs.filter(x=>x.op==='SSTORE').map(x=>({slot:toBeHex(BigInt(x.stack.at(-1)),32),value:toBeHex(BigInt(x.stack.at(-2)),32)}));
 const logs=tr.structLogs.filter(x=>/^LOG[0-4]$/.test(x.op)).map(x=>{const n=Number(x.op.slice(3)),s=x.stack.map(BigInt),offset=Number(s.at(-1)),size=Number(s.at(-2));return {topics:Array.from({length:n},(_,i)=>toBeHex(s.at(-3-i),32)),data:'0x'+x.memory.join('').replaceAll('0x','').slice(2*offset,2*(offset+size))};});
 return {result,writes,logs};
}
const report={ranAt:new Date().toISOString(),mutationMethodsUsed:[],compiler:'0.8.24',storageLayout:artifact.storageLayout,results:[]};
for(const s of scenarios){try{
 const diff={...stateDiff,...s.extra};
 const original=await observe(s.tx,{[A.PaperToken]:{stateDiff:diff}});
 const reconstructed=await observe(s.tx,{[A.PaperToken]:{code,stateDiff:diff}});
 assert.deepEqual(reconstructed,original);
 report.results.push({name:s.name,pass:true,original,reconstructed});
}catch(e){report.results.push({name:s.name,pass:false,error:String(e)});}}
fs.writeFileSync(new URL('./token-differential.json',import.meta.url),JSON.stringify(report,null,2));
console.log(report.results.map(x=>`${x.pass?'PASS':'FAIL'} ${x.name}${x.error?' '+x.error:''}`).join('\n'));
assert.ok(report.results.every(x=>x.pass));
