import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runtime} from './shared.mjs';

/// A pinned read-only upstream cache. New contracts created in this lab have
/// an empty source storage baseline, including after Anvil dump/load loses that flag.
export async function forkCache(endpoint){
 let cache={};try{cache=JSON.parse(await readFile(runtime+'/fork-cache.local.json','utf8'));}catch{}
 let pipeline=Promise.resolve(),last=0;
 const key=(method,params)=>createHash('sha256').update(JSON.stringify([method,params])).digest('hex');
 async function source(method,params=[]){
  const k=key(method,params);if(Object.hasOwn(cache,k))return cache[k];
  const job=pipeline.then(async()=>{
   if(Object.hasOwn(cache,k))return cache[k];
   for(let attempt=0;attempt<6;attempt++){
    const gap=Math.max(0,1000-(Date.now()-last));if(gap)await new Promise(r=>setTimeout(r,gap));last=Date.now();
    try{const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','User-Agent':'Mozilla/5.0'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(20000)});
     const payload=await res.json();if(!res.ok||payload.error)throw Error(payload.error?.message||'RPC '+res.status);
     cache[k]=payload.result;await writeFile(runtime+'/fork-cache.local.json',JSON.stringify(cache),{mode:0o600});return payload.result;
    }catch(e){if(attempt===5)throw e;await new Promise(r=>setTimeout(r,Math.min(15000,1000*2**attempt)));}
   }
  });pipeline=job.catch(()=>{});return job;
 }
 async function serve(fork){
  const tag='0x'+fork.blockNumber.toString(16);
  const allowed=new Set(['eth_chainId','net_version','eth_blockNumber','eth_getBlockByNumber','eth_getBlockByHash','eth_getBalance','eth_getCode','eth_getTransactionCount','eth_getStorageAt','eth_getProof','eth_getTransactionByHash','eth_getTransactionReceipt','eth_getLogs','eth_feeHistory','eth_gasPrice','eth_maxPriorityFeePerGas']);
  async function one(q){try{
   if(!allowed.has(q.method))throw Error('Read-only fork source: method blocked');if(q.method==='eth_blockNumber')return {jsonrpc:'2.0',id:q.id,result:tag};let params=[...(q.params||[])];
   if(['eth_getBalance','eth_getCode','eth_getTransactionCount'].includes(q.method))params[1]=tag;
   if(['eth_getStorageAt','eth_getProof'].includes(q.method))params[2]=tag;
   let created=new Set();try{const d=JSON.parse(await readFile(runtime+'/deployment.local.json','utf8'));created=new Set(Object.values(d.contracts).map(a=>a.toLowerCase()));}catch{}
   // CREATE succeeded after the source block. Its source baseline is provably empty;
   // local writes remain in Anvil and only cold baseline reads reach this proxy.
   if(created.has(String(params[0]).toLowerCase())){
    const zero={eth_getStorageAt:'0x'+'0'.repeat(64),eth_getCode:'0x',eth_getBalance:'0x0',eth_getTransactionCount:'0x0'};
    if(Object.hasOwn(zero,q.method))return {jsonrpc:'2.0',id:q.id,result:zero[q.method]};
   }
   return {jsonrpc:'2.0',id:q.id,result:await source(q.method,params)};
  }catch(e){return {jsonrpc:'2.0',id:q.id,error:{code:-32000,message:e.message}};}}
  const server=http.createServer(async(req,res)=>{let raw='';for await(const c of req){raw+=c;if(raw.length>1000000){res.writeHead(413);return res.end();}}try{const q=JSON.parse(raw),result=Array.isArray(q)?await Promise.all(q.map(one)):await one(q);res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));}catch{res.writeHead(400);res.end();}});
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(9546,'127.0.0.1',resolve);});return server;
 }
 return {source,serve};
}
