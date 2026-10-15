// Read-only client-side load driver for the isolated QA API.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const base=process.env.QA_BASE||'http://127.0.0.1:14173';assert.equal(new URL(base).host,'127.0.0.1:14173');const results=[];
for(const concurrency of [100,500,1000]){
 const count=5000,times=[],errors=[],start=performance.now();let next=0,bytes=0;const blocks=new Set();
 await Promise.all(Array.from({length:concurrency},async()=>{while(next<count){const i=next++,t=performance.now();try{const r=await fetch(base+'/api/state?actor='+i%10,{signal:AbortSignal.timeout(15000)}),text=await r.text();bytes+=Buffer.byteLength(text);assert(r.ok,text.slice(0,150));const s=JSON.parse(text);assert.equal(s.actor,i%10);assert.equal(s.metrics.cashInvariant,true);assert.equal(s.indexing.ready,true);assert(s.stateVersion.endsWith(s.blockHash));blocks.add(s.blockHash);}catch(e){errors.push(e.message);}times.push(performance.now()-t);}}));times.sort((a,b)=>a-b);const ms=performance.now()-start;
 const row={requests:count,concurrency,wallMs:ms,requestsPerSecond:count/ms*1000,bytes,p50Ms:times[2500],p95Ms:times[4750],p99Ms:times[4950],maxMs:times.at(-1),errors:errors.length,errorSamples:errors.slice(0,4),distinctCanonicalSnapshots:blocks.size};results.push(row);console.log(JSON.stringify(row));
}
if(process.env.QA_LOAD_OUTPUT)await writeFile(process.env.QA_LOAD_OUTPUT,JSON.stringify({capturedAt:new Date().toISOString(),scope:'HTTP load during real request/cancel writes on the isolated fork; same machine client/server',results},null,2)+'\n');if(results.some(r=>r.errors))process.exitCode=1;
