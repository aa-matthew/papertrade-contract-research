import test,{before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const base='http://127.0.0.1:4173';let checkpoint,heartbeat;
async function get(path='/api/state'){const r=await fetch(base+path);const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j;}
async function action(action,actor=6,args={}){const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1'},body:JSON.stringify({action,actor,...args})});const j=await r.json();assert.equal(r.status,200,JSON.stringify(j));return j.result;}
async function rpc(method,params=[]){const r=await fetch('http://127.0.0.1:9545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const j=await r.json();assert(!j.error,JSON.stringify(j));return j.result;}
async function until(fn,ms=10000){const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,100));}throw Error('Timed out');}
before(async()=>{const s=await until(async()=>{try{return await get();}catch{return false;}},30000);assert(!s.showcase.running);heartbeat=s.heartbeat;await action('heartbeat',2,{flag:false});});
beforeEach(async()=>{checkpoint=(await action('snapshot')).id;});
afterEach(async()=>{await action('restore',6,{id:checkpoint});});
after(async()=>{await action('heartbeat',2,{flag:heartbeat});});
test('Rust gateway, actual Redis and SQLite projection match public chain state; engine is private',async()=>{
 const s=await get(),b=await get('/api/backend'),i=await get('/api/index');assert.equal(s.backend.api,'rust-axum');assert.equal(b.redis.healthy,true);assert.equal(b.database.healthy,true);assert.equal(i.counts.accounts,10);assert.equal(i.counts.positions,s.positions.length);assert.equal(i.current.blockHash,s.blockHash);assert(!JSON.stringify(i).includes('privateKey'));
 assert.equal((await fetch('http://127.0.0.1:4174/api/wallets')).status,403);assert.equal((await fetch(base+'/api/state?actor=11')).status,400);assert.equal((await fetch(base+'/internal/meta')).status,404);
});
test('80 concurrent reader requests share one snapshot with no repeated contract eth_calls',async()=>{
 await get();const before=await get('/api/backend'),start=performance.now();const rows=await Promise.all(Array.from({length:80},(_,i)=>get('/api/state?actor='+(i%10))));const after=await get('/api/backend');assert.equal(new Set(rows.map(s=>s.stateVersion)).size,1);rows.forEach((s,i)=>assert.equal(s.actor,i%10));
 assert.equal(after.engine.rpc.methods.eth_call,before.engine.rpc.methods.eth_call);assert.equal(after.engine.collections,before.engine.collections);
 const report={requests:80,wallMs:performance.now()-start,contractRpcCalls:after.engine.rpc.methods.eth_call-before.engine.rpc.methods.eth_call,collections:after.engine.collections-before.engine.collections};await writeFile(new URL('../.runtime/backend-fanout.local.json',import.meta.url),JSON.stringify(report,null,2),{mode:0o600});
});
test('write-through invalidation and checkpoint revert remove phantom balances and indexed receipts',async()=>{
 const before=await get(),r=await action('deposit',6,{amount:'1'});assert.equal(BigInt((await get()).accounts[6].available),BigInt(before.accounts[6].available)+1000000n);await action('restore',6,{id:checkpoint});checkpoint=(await action('snapshot')).id;const s=await get(),i=await get('/api/index');assert.equal(s.accounts[6].available,before.accounts[6].available);assert(s.chainEpoch>before.chainEpoch);assert(!i.transactions.some(t=>t.hash===r.hash));assert.equal(i.current.blockHash,s.blockHash);
});
test('same-height external fork revert uses block hash/epoch and reconciles oracle/history/journal',async()=>{
 const before=await get(),id=await rpc('evm_snapshot'),published=await action('price',2,{market:1,amount:'91000'}),changed=await get();assert.notEqual(changed.markets[0].price,before.markets[0].price);await rpc('evm_revert',[id]);await rpc('evm_mine');
 const s=await until(async()=>{const v=await get();return v.chainEpoch>changed.chainEpoch&&v.markets[0].price===before.markets[0].price?v:null;});assert.equal(s.block,changed.block);assert.notEqual(s.blockHash,changed.blockHash);assert(!s.journal.some(j=>j.hash===published.hash));assert.deepEqual(s.markets[0].history,before.markets[0].history);const i=await get('/api/index');assert(!i.transactions.some(t=>t.hash===published.hash));assert.equal(i.current.blockHash,s.blockHash);
});
test('SSE emits a real oracle publication and preserves exact integer price',async()=>{
 const abort=new AbortController(),r=await fetch(base+'/api/events',{signal:abort.signal}),reader=r.body.getReader();assert.match(r.headers.get('content-type'),/text\/event-stream/);const target='83333000000000000000000';let buffer='';
 const result=(async()=>{while(true){const {value,done}=await reader.read();if(done)throw Error('Stream closed');buffer+=new TextDecoder().decode(value);let end;while((end=buffer.indexOf('\n\n'))>=0){const part=buffer.slice(0,end);buffer=buffer.slice(end+2);const data=part.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5).trimStart()).join('\n');if(data){const s=JSON.parse(data);if(s.markets[0].price===target)return s;}}}})();
 const timer=setTimeout(()=>abort.abort(),10000);try{const tx=await action('price',2,{market:1,amount:'83333'});const s=await result;assert(s.journal.some(j=>j.hash===tx.hash));assert.equal(s.markets[0].price,target);}finally{clearTimeout(timer);abort.abort();await reader.cancel().catch(()=>{});}
});
test('Redis outage degrades to verified engine/database and reconnects without stopping the fork',async()=>{
 const config=await readFile(new URL('../.runtime/redis.local.conf',import.meta.url),'utf8'),password=config.match(/^requirepass (.+)$/m)[1];await promisify(execFile)('redis-cli',['-p','6387','CLIENT','PAUSE','2500','ALL'],{env:{...process.env,REDISCLI_AUTH:password}});
 await action('heartbeat',2,{flag:false});const s=await get();assert.equal(s.chainId,31337);const b=await get('/api/backend');assert.equal(b.redis.healthy,false);await until(async()=>{const b=await get('/api/backend');return b.redis.healthy;},10000);assert.equal((await get()).metrics.cashInvariant,true);
});
test('same-price oracle publishes retain gas headroom across mined timestamps',async()=>{
 const s=await get(),price=(BigInt(s.markets[0].price)/10n**10n).toString(),amount=price.slice(0,-8)+'.'+price.slice(-8);for(let i=0;i<6;i++){const r=await action('price',2,{market:1,amount});assert.equal((await get('/api/receipt/'+r.hash)).status,1);}
});
test('engine outage fails closed instead of serving a persisted snapshot as fresh',async()=>{
 const service=JSON.parse(await readFile(new URL('../.runtime/service.local.json',import.meta.url),'utf8')),children=(await promisify(execFile)('pgrep',['-P',String(service.pid)])).stdout.trim().split(/\s+/);let pid;
 for(const child of children){const command=(await promisify(execFile)('ps',['-p',child,'-o','command='])).stdout;if(command.includes('/demo/scripts/server.mjs'))pid=Number(child);}assert(pid,'Managed private engine PID required');
 await get();process.kill(pid,'SIGSTOP');try{await new Promise(r=>setTimeout(r,2200));const start=performance.now(),r=await fetch(base+'/api/state',{signal:AbortSignal.timeout(6000)});assert.equal(r.status,503);const error=await r.json();assert.equal(error.stale,true);assert.equal(error.accounts,undefined);assert(performance.now()-start<3500);}finally{process.kill(pid,'SIGCONT');}
 await until(async()=>{try{return (await get()).backend.api==='rust-axum';}catch{return false;}},10000);
});
