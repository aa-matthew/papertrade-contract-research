import assert from 'node:assert/strict';
import {read,save} from './shared.mjs';
const base='http://127.0.0.1:4173';
async function get(path='/api/state'){const r=await fetch(base+path);if(!r.ok)throw Error(await r.text());return r.json();}
async function action(action,args={}){const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1'},body:JSON.stringify({actor:6,action,...args})});if(!r.ok)throw Error(await r.text());return (await r.json()).result;}
const initial=await get();assert(!initial.testing&&!initial.showcase.running,'Finish any active showcase/test first');const checkpoint=(await action('snapshot')).id;
try{
 await action('heartbeat',{flag:false});await get();const before=await get('/api/backend'),times=[];
 for(let i=0;i<100;i++){const start=performance.now();await get();times.push(performance.now()-start);}times.sort((a,b)=>a-b);
 const start=performance.now();await Promise.all(Array.from({length:80},(_,i)=>get('/api/state?actor='+i%10)));const wall=performance.now()-start,after=await get('/api/backend');
 let baseline;try{baseline=await read('backend-baseline.local.json');}catch{}
 const result={capturedAt:new Date().toISOString(),scope:'Warm local API response + JSON parsing; not transaction settlement latency or a production benchmark',baseline,sequential:{requests:100,p50Ms:times[50],p95Ms:times[94]},fanout:{requests:80,wallMs:wall},rpcDelta:{contractCalls:after.engine.rpc.methods.eth_call-before.engine.rpc.methods.eth_call,allRequests:after.engine.rpc.requests-before.engine.rpc.requests,collections:after.engine.collections-before.engine.collections},backend:'Rust Axum + Redis + SQLite WAL'};
 assert.equal(result.rpcDelta.contractCalls,0);assert.equal(result.rpcDelta.collections,0);await save('backend-benchmark.local.json',result);console.log(JSON.stringify(result,null,2));
}finally{await action('restore',{id:checkpoint});}
