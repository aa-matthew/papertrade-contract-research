import test,{before,after,beforeEach,afterEach} from 'node:test';
import assert from 'node:assert/strict';
const base='http://127.0.0.1:4173';let checkpoint;
async function state(){const r=await fetch(base+'/api/state');const s=await r.json();assert.equal(r.status,200,JSON.stringify(s));return s;}
async function action(action,actor=6,args={},reject=false){const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1'},body:JSON.stringify({action,actor,...args})}),j=await r.json();if(reject){assert.equal(r.status,400,'Expected role/state rejection');return j;}assert.equal(r.status,200,JSON.stringify(j));return j.result;}
async function read(contract,fn,args=[]){return (await action('contract',6,{contract,fn,args})).result;}
const U=1000000n;
before(async()=>{let ready=false;for(let i=0;i<100;i++){try{const r=await fetch(base+'/api/state');if(r.ok){ready=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,200));}assert(ready,'Start the lab with npm run up --prefix demo');await action('heartbeat',2,{flag:false});});
beforeEach(async()=>{checkpoint=(await action('snapshot')).id;});
afterEach(async()=>{await action('restore',6,{id:checkpoint});});
after(async()=>{await action('heartbeat',2,{flag:true});});
test('Robinhood fork evidence, ten funded actors, real ownership and reconstructed runtime',async()=>{
 const s=await state();assert.equal(s.chainId,31337);assert.equal(s.fork.sourceChainId,4663);assert.equal(new Set(s.actors.map(a=>a.address)).size,10);assert(s.accounts.every(a=>BigInt(a.native)>0n));assert.equal(s.metrics.owner,s.contracts.governance);assert.equal(s.metrics.guardian,s.actors[1].address);assert.equal(s.metrics.cashInvariant,true);assert.match(await read('exchange','reconstruction'),/Recovered SettlementMath/);const w=await(await fetch(base+'/api/wallets')).json();assert.equal(w.length,10);assert(w.every(a=>a.privateKey?.length===66));
});
test('collateral approval, deposit, withdrawal and receipt are actual local transactions',async()=>{
 const s=await state(),before=BigInt(s.accounts[6].available);const r=await action('deposit',6,{amount:'123.45'});assert.equal(BigInt((await state()).accounts[6].available),before+123450000n);const receipt=await(await fetch(base+'/api/receipt/'+r.hash)).json();assert.equal(receipt.status,1);assert(r.events.some(e=>e.name==='Deposited'));await action('withdraw',6,{amount:'123.45'});assert.equal(BigInt((await state()).accounts[6].available),before);assert.equal((await state()).metrics.cashInvariant,true);
});
test('operator authorization is enforced on-chain, not by the role picker',async()=>{
 const before=(await state()).markets[0].price;await action('price',6,{market:1,amount:'90000'},true);assert.equal((await state()).markets[0].price,before);await action('contract',6,{contract:'collateral',fn:'mint',args:[(await state()).actors[6].address,'1000000']},true);await action('pause',6,{},true);
});
test('committed open reserves cash, can cancel and supports separate keeper execution',async()=>{
 const before=await state(),r=await action('open',6,{amount:'120',leverage:20,market:1,isLong:true,auto:false});let s=await state();assert(s.orders.some(o=>String(o.id)===r.orderId));assert.equal(BigInt(s.accounts[6].available),BigInt(before.accounts[6].available)-120n*U);await action('cancel',6,{id:r.orderId});assert.equal(BigInt((await state()).accounts[6].available),BigInt(before.accounts[6].available));const next=await action('open',7,{amount:'100',leverage:10,market:2,isLong:false,auto:false});await action('execute',3,{id:next.orderId});assert.equal(Number((await state()).metrics.openCount),Number(before.metrics.openCount)+1);
});
test('profitable close uses recovered haircut and emits a cash payout',async()=>{
 const s=await state(),pos=s.positions.find(p=>p.user===s.actors[6].address);const before=BigInt(s.accounts[6].available);await action('price',2,{market:1,amount:'84000'});const r=await action('close',6,{id:pos.id});const after=await state();assert(!after.positions.some(p=>p.id===pos.id));const W=10n**18n,entry=BigInt(pos.entry)/10n**10n,exit=84000n*10n**8n,distance=exit-entry-entry/50000n,move=distance*W/entry,raw=BigInt(pos.margin)*BigInt(pos.leverage)*distance/entry,d1=move*BigInt(pos.impact.rate)/W,d2=1000000n*move*BigInt(pos.impact.position)/W,scale=(W-BigInt(pos.impact.base))*W/(W+W*W/d1+BigInt(pos.impact.referenceUsd)*W/d2),adjusted=raw*scale/W,net=adjusted-adjusted*200n/10000n;
 assert.equal(BigInt(after.accounts[6].available),before+BigInt(pos.margin)+net);const payouts=after.journal.flatMap(j=>j.events).filter(e=>e.name==='ProfitPaid');assert(payouts.length>0);assert.equal(after.metrics.cashInvariant,true);
});
test('losing close mints recovered PART and cannot move it wallet-to-wallet',async()=>{
 const s=await state(),pos=s.positions.find(p=>p.user===s.actors[6].address);await action('price',2,{market:1,amount:'81000'});await action('close',6,{id:pos.id});const a=await state();assert(BigInt(a.accounts[6].part)>BigInt(s.accounts[6].part));await action('contract',6,{contract:'token',fn:'transfer',args:[s.actors[7].address,'1']},true);assert.equal(a.metrics.cashInvariant,true);
});
test('liquidator closes an unhealthy position and full-margin basis mints participation',async()=>{
 const s=await state(),pos=s.positions.find(p=>p.user===s.actors[6].address);await action('price',2,{market:1,amount:'70000'});const r=await action('liquidate',4,{id:pos.id});assert(r.events.some(e=>e.name==='Closed'&&e.args[3]===true));assert.equal(BigInt((await state()).accounts[6].part)-BigInt(s.accounts[6].part),BigInt(pos.margin)*100n*10n**12n);
});
test('Carol stake, funded rewards, wallet claim and unstake all reconcile',async()=>{
 const s=await state();assert(BigInt(s.accounts[8].staked)>0n);const wallet=BigInt(s.accounts[8].wallet),reward=BigInt(s.accounts[8].rewards);assert(reward>0n);await action('claim',8);assert.equal(BigInt((await state()).accounts[8].wallet),wallet+reward);await action('unstake',8,{amount:'100'});await action('stake',8,{amount:'100'});assert.equal((await state()).accounts[8].staked,s.accounts[8].staked);
});
test('session relayer signs Alice typed order; revoke blocks already pending execution',async()=>{
 const r=await action('open',9,{market:1,amount:'25',leverage:10,isLong:true,session:true,auto:false});await action('revoke',6);await action('execute',3,{id:r.orderId},true);await action('cancel',6,{id:r.orderId});assert.equal((await state()).metrics.cashInvariant,true);
});
test('guardian pause and delayed governor unpause cannot bypass timelock',async()=>{
 await action('pause',1);await action('open',6,{amount:'10',leverage:5,auto:false},true);await action('pause',0,{flag:false},true);const op=await action('governanceSchedule',0,{contract:'exchange',fn:'setOpensPaused',args:[false]});await action('governanceExecute',0,{id:op.operationId},true);await action('advance',0,{seconds:86401});await action('governanceExecute',0,{id:op.operationId});assert.equal((await state()).metrics.opensPaused,false);
});
test('terminal retirement preserves exit at frozen price',async()=>{
 const s=await state(),pos=s.positions.find(p=>p.user===s.actors[6].address);await action('retire',1,{market:1});const frozen=(await state()).markets[0].retiredPrice;await action('price',2,{market:1,amount:'90000'});await action('close',6,{id:pos.id});assert.equal((await state()).markets[0].retiredPrice,frozen);await action('open',6,{market:1,amount:'10',leverage:5},true);
});
test('$5m daily limit caps direct profit; FIFO survives reset and needs real house cash',async()=>{
 await action('faucet',6,{amount:'1000000'});await action('deposit',6,{amount:'1000000'});const r=await action('open',6,{amount:'1000000',leverage:100,market:1,isLong:true});const s=await state(),pos=s.positions.find(p=>p.margin==='1000000000000');assert(pos);await action('price',2,{market:1,amount:'90434.685'});await action('close',6,{id:pos.id});let after=await state();assert.equal(after.metrics.dailyPayoutRemaining,'0');assert(BigInt(after.metrics.totalQueued)>0n);const queued=after.metrics.totalQueued;await action('harvest',3);assert.equal((await state()).metrics.totalQueued,queued);await action('withdraw',6,{amount:'1000000'});await action('seed',5,{amount:'1000000'});await action('advance',3,{seconds:86401});assert.equal((await state()).metrics.dailyPayoutRemaining,'5000000000000');await action('harvest',3);after=await state();assert.equal(after.metrics.totalQueued,'0');assert.equal(after.metrics.cashInvariant,true);
});
test('loopback API rejects cross-origin writes and missing local request header',async()=>{
 let r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(r.status,403);r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1','Origin':'https://example.com'},body:'{}'});assert.equal(r.status,403);
});
test('stale or paused oracle rejects fills while wallet cash withdrawals remain usable',async()=>{
 await action('advance',0,{seconds:31});await action('contract',6,{contract:'oracle',fn:'price',args:[1]},true);await action('withdraw',6,{amount:'1'});await action('price',2,{market:1,amount:'82213.35'});await action('oraclePause',1);const r=await action('open',6,{amount:'10',leverage:5,auto:false});await action('execute',3,{id:r.orderId},true);await action('cancel',6,{id:r.orderId});assert.equal((await state()).metrics.cashInvariant,true);
});
test('close-all settles only active actor positions and preserves other traders',async()=>{
 await action('open',6,{market:1,amount:'25',leverage:5,isLong:true});const before=await state();assert(before.positions.filter(p=>p.user===before.actors[6].address).length>=2);
 const r=await action('closeAll',6);assert.equal(r.closed,2);const s=await state();assert(!s.positions.some(p=>p.user===s.actors[6].address));assert(s.positions.some(p=>p.user===s.actors[7].address));assert.equal(s.metrics.cashInvariant,true);
});
test('pinned source cache separates empty creation baseline from deployed runtime and blocks upstream writes',async()=>{
 const s=await state();async function rpc(url,method,params=[]){return (await(await fetch(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})})).json());}
 const source='http://127.0.0.1:9546';assert.equal((await rpc(source,'eth_getCode',[s.contracts.exchange,'latest'])).result,'0x');assert((await rpc('http://127.0.0.1:9545','eth_getCode',[s.contracts.exchange,'latest'])).result.length>1000);
 assert.equal(Number(BigInt((await rpc(source,'eth_blockNumber')).result)),s.fork.blockNumber);assert.match((await rpc(source,'eth_sendRawTransaction',['0x'])).error.message,/blocked/);
});
