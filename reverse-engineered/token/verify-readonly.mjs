import { JsonRpcProvider, AbiCoder, Interface } from 'ethers';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { WAD as W, mintQuote } from './mint-model.mjs';
const endpoint = process.env.LOCAL_RPC_URL ?? 'http://127.0.0.1:8545';
assert.ok(['localhost','127.0.0.1','[::1]'].includes(new URL(endpoint).hostname));
const p = new JsonRpcProvider(endpoint), coder = AbiCoder.defaultAbiCoder();
assert.equal(await p.send('eth_chainId',[]),'0x7a69');
const A = JSON.parse(fs.readFileSync(new URL('../../inspection/official-addresses.json',import.meta.url)));
const out = { endpoint, chainId:31337, ranAt:new Date().toISOString(), mutationMethodsUsed:[], results:[] };
async function test(name,f){try{out.results.push({name,pass:true,evidence:await f()});}catch(e){out.results.push({name,pass:false,error:String(e)});}}
function raw(selector,types=[],args=[]){return selector+coder.encode(types,args).slice(2)}
for (const [lp,h,basis] of [[-100n,0n,10n],[0n,0n,100n],[1999999n,0n,2n],[2000000n,0n,100n],[3000000n,20000000n,100n],[5000000n,171247680n,100n],[0n,171247680n,100n],[1999999n,171247680n,2000001n],[5000000n,171247680n,0n],[2000000n,0n,120000000n]]){
 const args=[lp*W,h*W,basis*W,2000000n*W,100n*W,120000000n*W];
 await test(`Library quote lp=${lp}, H=${h}, basis=${basis}`,async()=>{
  const result=[...coder.decode(['uint256','uint256'],await p.call({to:'0xe991817199363046da0a28da6fbad0284e4aa492',data:raw('0x7aac24ba',['int256','uint256','uint256','uint256','uint256','uint256'],args)}))];assert.deepEqual(result,mintQuote(...args));return {args:args.map(String),result:result.map(String)};
 });
}
const user='0x0000000000000000000000000000000000000123',other='0x0000000000000000000000000000000000000456';
const token = new Interface(['function transfer(address,uint256) returns(bool)','function transferFrom(address,address,uint256) returns(bool)','function allowance(address,address) view returns(uint256)','function mint(address,uint256)','function burn(address,uint256)']);
const slots=[];for(let i=0;i<=9;i++) slots.push(await p.getStorage(A.PaperToken,i));out.tokenSlots=slots;
const role5='0x'+slots[5].slice(-40),staking='0x'+slots[9].slice(-40);
for (const [label,from,method,args,expected] of [
 ['user transfer to user',user,'transfer',[other,0n],false],
 ['user transfer to staking',user,'transfer',[staking,0n],false],
 ['staking transfer to user',staking,'transfer',[user,0n],true],
 ['staking transferFrom user to staking',staking,'transferFrom',[user,staking,0n],true],
 ['staking transferFrom user to other',staking,'transferFrom',[user,other,0n],false],
 ['role5 transferFrom user to staking (same deployed address as staking)',role5,'transferFrom',[user,staking,0n],true]
])await test(label,async()=>{let success=true,ret;try{ret=await p.call({to:A.PaperToken,from,data:token.encodeFunctionData(method,args)});}catch(e){success=false;ret=e.data;} assert.equal(success,expected);return {from,args:args.map(String),success,ret};});
await test('role5 has implicit maximum allowance',async()=>{const r=await p.call({to:A.PaperToken,data:token.encodeFunctionData('allowance',[user,role5])});assert.equal(coder.decode(['uint256'],r)[0],(1n<<256n)-1n);return {role5,allowance:r};});
for(const [selector,label] of [['0xdb006a75','redeem'],['0xfe16eae8','quoteRedemption']])for(const amount of [0n,1n,100n*W])await test(`${label} always-disabled path amount=${amount}`,async()=>{let reverted=false,data;try{await p.call({to:A.PaperTokenomics,data:raw(selector,['uint256'],[amount])});}catch(e){reverted=true;data=e.data;}assert.ok(reverted);assert.equal(data,'0x32aa90b0');return {data};});
// Traces execute only ephemeral eth_call state. They do not send a transaction.
for (const [selector,types,args] of [['0x0efdf838',['address','uint256','bool','uint256','uint256'],[user,100n*W,true,98n*W,17n]],['0xed722c96',['address','uint256','uint256','uint256'],[user,100n*W,98n*W,0n]],['0xc218c676',['uint256'],[1n*W]]])await test(`Exchange-only hook ${selector} trace`,async()=>{
 const lpBefore=BigInt(await p.getStorage(A.PaperTokenomics,3));
 const tx={from:A.Exchange,to:A.PaperTokenomics,data:raw(selector,types,args)};
 const tr=await p.send('debug_traceCall',[tx,'latest',{enableMemory:true}]);
 const records=tr.structLogs.filter(x=>['SSTORE','DELEGATECALL','CALL','LOG1','LOG2','LOG3'].includes(x.op)).map(x=>({pc:'0x'+x.pc.toString(16),depth:x.depth,op:x.op,stack:x.stack,memory:x.op.includes('CALL')?x.memory:undefined}));
 assert.equal(tr.failed,false);
 const writes=records.filter(x=>x.depth===2&&x.op==='SSTORE'&&BigInt(x.stack.at(-1))===3n);
 const expectedDelta=selector==='0x0efdf838'?17n:selector==='0xed722c96'?-100n*W:-W;
 assert.equal(BigInt(writes.at(-1).stack.at(-2))-lpBefore,expectedDelta);
 return {lpBefore:String(lpBefore),expectedDelta:String(expectedDelta),failed:tr.failed,returnValue:tr.returnValue,records};
});
fs.writeFileSync(new URL('./verification.json',import.meta.url),JSON.stringify(out,null,2));
console.log(out.results.map(x=>`${x.pass?'PASS':'FAIL'} ${x.name}${x.error?' '+x.error:''}`).join('\n'));
assert.ok(out.results.every(x=>x.pass));
