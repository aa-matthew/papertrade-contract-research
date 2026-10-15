import test from 'node:test';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4173';
async function get(path='/api/showcase'){const r=await fetch(base+path);assert(r.ok,await r.clone().text());return r.json();}
async function command(args,expected=200){const r=await fetch(base+'/api/showcase',{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1'},body:JSON.stringify(args)}),j=await r.json();assert.equal(r.status,expected,JSON.stringify(j));return j.result;}
async function finished(timeout=90000){const end=Date.now()+timeout;while(Date.now()<end){const s=await get();if(!s.running)return s;await new Promise(r=>setTimeout(r,250));}await command({command:'stop'});throw Error('Showcase timeout');}
const balances=s=>s.accounts.map(({native,...a})=>a);
test('full tour executes ten protocol phases, captures successful receipts and restores balances',async()=>{
 const before=await get('/api/state');await command({command:'start',source:'scenario',kind:'tour',paceMs:0});const s=await finished();assert.equal(s.outcome,'completed',s.error);assert.equal(s.completed.length,10);assert.equal(s.restored,true);assert(s.quotes>=20);assert(s.receipts.length>40);assert(s.receipts.every(r=>r.status===1));assert(s.receipts.some(r=>r.method==='liquidate'));assert(s.receipts.some(r=>r.method==='claim'));assert(s.receipts.some(r=>r.method==='harvest'));assert(s.receipts.some(r=>r.method==='retireMarket'));assert(s.receipts.some(r=>r.method==='sweepSurplus'));assert.equal(new Set(s.receipts.map(r=>r.actor)).size,10);assert.equal(s.queueProof.remaining,'0');assert(BigInt(s.queueProof.queued)>0n);
 const after=await get('/api/state');assert.deepEqual(balances(after),balances(before));assert.deepEqual(after.positions,before.positions);assert.equal(after.testing,false);
});
test('continuous mode reserves checkpoint, rejects duplicate/manual writes and stops cleanly',async()=>{
 await command({command:'start',source:'scenario',kind:'market',duration:30,paceMs:0});await command({command:'start'},400);
 const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1'},body:JSON.stringify({action:'faucet',actor:6,amount:'1'})});assert.equal(r.status,409);
 await new Promise(r=>setTimeout(r,2000));const s=await command({command:'stop'});assert.equal(s.outcome,'stopped');assert.equal(s.restored,true);assert.equal(s.feed,'OFF');assert.equal((await get('/api/state')).testing,false);
});
test('Binance market mode publishes live quotes and completes real long/short round trips',async()=>{
 await command({command:'start',source:'binance',kind:'market',duration:10,paceMs:0});const s=await finished();assert.equal(s.outcome,'completed',s.error);assert.equal(s.restored,true);assert(s.quotes>=8);assert(s.trades>=4);assert.equal(s.feed,'OFF');
});
