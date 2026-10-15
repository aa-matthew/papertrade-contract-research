// Read-only: eth_call/debug_traceCall only. Does not persist fork state.
import {readFile,writeFile} from 'node:fs/promises';
import {AbiCoder,id,ZeroAddress,ZeroHash} from 'ethers';
const coder=AbiCoder.defaultAbiCoder();
const a=JSON.parse(await readFile('inspection/official-addresses.json'));
const txs=JSON.parse(await readFile('inspection/transaction-samples.json'));
const sample=txs.find(x=>x.transaction?.input?.startsWith('0x251fb27d')).transaction;
const endpoint=process.env.LOCAL_RPC_URL??'http://127.0.0.1:8545';
if(!['127.0.0.1','localhost','[::1]'].includes(new URL(endpoint).hostname))throw Error('Loopback only');
async function rpc(method,params){const r=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});return await r.json();}
const type='tuple(address target,bytes data,bool allowFailure,bytes32 failureGroup,bytes32 itemId)[]';
const decoded=coder.decode([type],'0x'+sample.input.slice(10))[0];
const canonical='execute((address,bytes,bool,bytes32,bytes32)[])';
const enc=calls=>id(canonical).slice(0,10)+coder.encode([type],[calls]).slice(2);
const base={from:sample.from,to:a.BatchExecutor};
const group='0x'+'12'.repeat(32);
const blocked=[ZeroAddress,'0x12345678',true,group,ZeroHash];
const cases=[['unauthorized empty',{...base,from:'0x0000000000000000000000000000000000001234',data:enc([])}],['authorized empty',{...base,data:enc([])}],['blocked selector failure allowed',{...base,data:enc([blocked])}],['same failed group second call skipped',{...base,data:enc([blocked,blocked])}],['blocked selector failure forbidden',{...base,data:enc([[ZeroAddress,'0x12345678',false,ZeroHash,ZeroHash]])}]];
const results=[];
for(const [name,call]of cases){const result=await rpc('eth_call',[call,'latest']); const trace=await rpc('debug_traceCall',[call,'latest',{disableStorage:true,disableMemory:true}]);const logs=trace.result?.structLogs;results.push({name,call,result,trace:logs?{failed:trace.result.failed,gas:trace.result.gas,pcs:logs.filter(x=>x.depth===2).map(x=>x.pc),externalCalls:logs.filter(x=>['CALL','STATICCALL','DELEGATECALL'].includes(x.op)).map(x=>({pc:x.pc,depth:x.depth,op:x.op,stack:x.stack?.slice(-7)}))}:trace});}
const out={scope:'read-only local eth_call and debug_traceCall',canonical,selector:id(canonical).slice(0,10),sampleHash:sample.hash,relayer:sample.from,roundTripMatches:enc(decoded)===sample.input,results};
await writeFile('reverse-engineered/auth/probes.json',JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({canonical,selector:out.selector,roundTripMatches:out.roundTripMatches,results:results.map(x=>({name:x.name,result:x.result,failed:x.trace.failed}))},null,2));
