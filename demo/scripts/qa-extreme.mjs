// Destructive stress QA: requires a separate fork and private API, never the demo ports.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
import {performance} from 'node:perf_hooks';
import {E} from './shared.mjs';
const base=process.env.QA_BASE||'http://127.0.0.1:14173',rpcUrl=process.env.QA_RPC||'http://127.0.0.1:19545',runtime=process.env.QA_RUNTIME,output=process.env.QA_OUTPUT;
assert(runtime&&output,'QA_RUNTIME and QA_OUTPUT required');assert(/^\/(?:private\/)?tmp\/robinpaper-extreme-qa-/.test(runtime),'Use a disposable QA runtime, never the live runtime');assert.equal(new URL(base).hostname,'127.0.0.1');assert.equal(new URL(rpcUrl).hostname,'127.0.0.1');assert(!['4173','4174'].includes(new URL(base).port),'Never stress the live demo');assert.notEqual(new URL(rpcUrl).port,'9545','Never mutate the live fork');
const isolation=JSON.parse(await readFile(runtime+'/qa-isolation.local.json','utf8'));assert.equal(new URL(base).port,isolation.publicPort,'API/runtime mismatch');assert.equal(new URL(rpcUrl).port,isolation.rpcPort,'RPC/runtime mismatch');
await mkdir(output,{recursive:true,mode:0o700});const exec=promisify(execFile),provider=new E.JsonRpcProvider(rpcUrl,undefined,{cacheTimeout:-1,batchMaxCount:1});provider.pollingInterval=50;
const manifest=JSON.parse(await readFile(runtime+'/deployment.local.json')),build=JSON.parse(await readFile(runtime+'/compiled.local.json')),wallets=JSON.parse(await readFile(runtime+'/wallets.local.json')),signers=await Promise.all(wallets.map(w=>provider.getSigner(w.address))),names={exchange:'ReconstructedLabExchange',collateral:'LabCollateral',oracle:'LabOracle',token:'ProtocolToken',staking:'ProtocolStaking',governance:'ProtocolTimelock'},c={};for(const[k,v]of Object.entries(manifest.contracts))c[k]=new E.Contract(v,build.contracts[names[k]].abi,provider);
// The load generator uses direct JSON-RPC so its own batching delay does not
// dominate thousands of sequential contract writes.
let requestId=0;provider.send=async(method,params=[])=>{const r=await fetch(rpcUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:++requestId,method,params}),signal:AbortSignal.timeout(20000)}),j=await r.json();if(!r.ok||j.error){const e=Error(j.error?.message||'RPC '+r.status);if(j.error)Object.assign(e,j.error);throw e;}return j.result;};
const report={startedAt:new Date().toISOString(),base,rpc:rpcUrl,isolated:true,environment:{node:process.version,platform:process.platform},cases:[],failures:[]};
const delay=ms=>new Promise(r=>setTimeout(r,ms)),safe=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v));
async function flush(){await writeFile(output+'/extreme-results.json',JSON.stringify(safe(report),null,2)+'\n');}
async function get(path='/api/state'){const r=await fetch(base+path,{signal:AbortSignal.timeout(15000)}),j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j;}
async function action(action,args={},actor=6){const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1'},body:JSON.stringify({action,actor,...args}),signal:AbortSignal.timeout(30000)}),j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j.result;}
async function until(fn,ms=20000){const end=Date.now()+ms;let last;while(Date.now()<end){try{const v=await fn();if(v)return v;}catch(e){last=e.message;}await delay(100);}throw Error('Timed out: '+last);}
const pct=(arr,p)=>arr[Math.min(arr.length-1,Math.floor(arr.length*p))]??null;
const summarize=values=>{const v=[...values].sort((a,b)=>a-b);return {p50Ms:pct(v,.5),p95Ms:pct(v,.95),p99Ms:pct(v,.99),maxMs:v.at(-1)};};
const gasStats=values=>{const v=[...values].sort((a,b)=>a-b);return {p50Gas:pct(v,.5),p95Gas:pct(v,.95),p99Gas:pct(v,.99),maxGas:v.at(-1)};};
async function load({requests,concurrency,path=i=>'/api/state?actor='+(i%10)}){
 const samples=[],errors=[],codes={},start=performance.now();let cursor=0,bytes=0;
 await Promise.all(Array.from({length:concurrency},async()=>{while(cursor<requests){const i=cursor++,t=performance.now();try{const r=await fetch(base+path(i),{signal:AbortSignal.timeout(15000)}),body=await r.text();bytes+=Buffer.byteLength(body);codes[r.status]=(codes[r.status]||0)+1;if(r.status!==200)errors.push({i,status:r.status,body:body.slice(0,180)});else{const s=JSON.parse(body);if(s.accounts){assert.equal(s.actor,i%10);assert.equal(s.accounts[s.actor].index,s.actor);assert.equal(s.metrics.cashInvariant,true);assert(s.stateVersion.endsWith(s.blockHash));}}}catch(e){errors.push({i,error:e.message});}samples.push(performance.now()-t);}}));
 const ms=performance.now()-start;return {requests,concurrency,wallMs:ms,requestsPerSecond:requests/(ms/1000),bytes,statuses:codes,errorCount:errors.length,errors:errors.slice(0,10),...summarize(samples)};
}
async function run(name,fn){if(process.env.QA_CASES&&!new RegExp(process.env.QA_CASES).test(name))return;const start=performance.now();try{const result=await fn();report.cases.push({name,passed:true,wallMs:performance.now()-start,...safe(result)});console.log('PASS',name,JSON.stringify(safe(result)));}catch(e){report.cases.push({name,passed:false,wallMs:performance.now()-start,error:e.message,stack:e.stack});report.failures.push(name);console.log('FAIL',name,e.message);}await flush();}
const nonceState=new Map();
async function allocateNonce(actor){let slot=nonceState.get(actor);if(!slot){slot={next:undefined,queue:Promise.resolve()};nonceState.set(actor,slot);}const p=slot.queue.then(async()=>{if(slot.next===undefined)slot.next=Number(BigInt(await provider.send('eth_getTransactionCount',[wallets[actor].address,'pending'])));return slot.next++;});slot.queue=p.catch(()=>{});return p;}
async function checkpoint(fn){await provider.send('anvil_dropAllTransactions',[]);const id=(await action('snapshot')).id;try{return await fn();}finally{await provider.send('anvil_dropAllTransactions',[]);await action('restore',{id});nonceState.clear();}}
const service=JSON.parse(await readFile(runtime+'/service.local.json'));const children=(await exec('pgrep',['-P',String(service.pid)])).stdout.trim().split(/\s+/);const pids={};for(const pid of children){const command=(await exec('ps',['-p',pid,'-o','command='])).stdout;if(command.includes('/scripts/server.mjs'))pids.engine=Number(pid);else if(command.includes('robinpaper-api'))pids.api=Number(pid);else if(command.includes('redis-server'))pids.redis=Number(pid);else if(/\banvil\b/.test(command))pids.anvil=Number(pid);}
report.environment.processes=pids;report.environment.machine=(await exec('sysctl',['-n','hw.model','hw.memsize','hw.ncpu'])).stdout.trim().split('\n');
const peaks={};let sampling=false;const sampler=setInterval(async()=>{if(sampling)return;sampling=true;try{const out=(await exec('ps',['-p',Object.values(pids).join(','),'-o','pid=,rss=,%cpu='])).stdout;for(const line of out.trim().split('\n')){const[pid,rss,cpu]=line.trim().split(/\s+/).map(Number),name=Object.keys(pids).find(k=>pids[k]===pid);if(name)peaks[name]={peakRssMiB:Math.max(peaks[name]?.peakRssMiB||0,rss/1024),maxObservedCpuPercent:Math.max(peaks[name]?.maxObservedCpuPercent||0,cpu)};}}catch{}finally{sampling=false;}},250);sampler.unref();
let rootCheckpoint;
try{
 const initial=await until(()=>get(),30000);assert(!initial.shared,'Run on the isolated rehearsal API');assert.equal(initial.chainId,31337);assert.equal(initial.fork.sourceChainId,4663);assert.equal(initial.testing,false);report.initial={block:initial.block,positions:initial.positions.length,sourceFork:initial.fork.blockNumber};report.fixtureNotes=['32 deterministic development EOAs use explicitly empty source baselines only in the disposable QA source proxy, then receive local test ETH.','Queued transactions are cleared between disposable checkpoints; EVM revert alone does not clear the mempool.'];for(const[k,address]of Object.entries(manifest.contracts))assert.equal(E.keccak256(await provider.send('eth_getCode',[address,'latest'])),manifest.runtimeHashes[k]);report.runtimeHashes=manifest.runtimeHashes;
 rootCheckpoint=(await action('snapshot')).id;await action('heartbeat',{flag:false},2);
 for(const spec of [{requests:1000,concurrency:1},{requests:2000,concurrency:50},{requests:5000,concurrency:250},{requests:10000,concurrency:1000}])await run('cached reads '+spec.requests+' / concurrency '+spec.concurrency,async()=>{await get();const before=await get('/api/backend'),r=await load(spec),after=await get('/api/backend');assert.equal(r.errorCount,0);return {...r,engineCollections:after.engine.collections-before.engine.collections,contractRpcCalls:(after.engine.rpc.methods.eth_call||0)-(before.engine.rpc.methods.eth_call||0)};});
 await run('100 SSE clients + concurrent 3000 reads + 8 real oracle publications',async()=>{
  const controllers=[],streams=[],observed=Array.from({length:100},()=>new Map()),ready=new Set(),startTimes=new Map(),latencies=[],checks=[];let stopping=false;
  const tasks=Array.from({length:100},async(_,i)=>{const ac=new AbortController();controllers.push(ac);try{const response=await fetch(base+'/api/events',{signal:ac.signal});assert(response.ok);const reader=response.body.getReader();streams.push(reader);let buf='',last;while(!stopping){const{value,done}=await reader.read();if(done)break;buf+=new TextDecoder().decode(value);let end;while((end=buf.indexOf('\n\n'))>=0){const event=buf.slice(0,end);buf=buf.slice(end+2);const raw=event.split('\n').filter(l=>l.startsWith('data:')).map(l=>l.slice(5)).join('\n');if(!raw)continue;const s=JSON.parse(raw);ready.add(i);if(last&&s.chainEpoch===last.chainEpoch)assert(s.stateRevision>=last.stateRevision);last=s;const price=s.markets[0].price;if(startTimes.has(price)&&!observed[i].has(price)){const latency=performance.now()-startTimes.get(price);observed[i].set(price,latency);latencies.push(latency);}assert.equal(s.metrics.cashInvariant,true);}}}catch(e){if(!ac.signal.aborted)checks.push(e.message);}});
  try{await until(()=>ready.size===100,15000);const readers=load({requests:3000,concurrency:200});for(let i=0;i<8;i++){const price=String(85000+i),raw=E.parseEther(price).toString();startTimes.set(raw,performance.now());await action('price',{market:1,amount:price},2);await until(()=>observed.every(m=>m.has(raw)),15000);}const http=await readers;assert.equal(http.errorCount,0);assert.equal(checks.length,0);return {clients:100,publications:8,deliveredObservations:latencies.length,latencyFromPublishRequest:summarize(latencies),http,checks};}
  finally{stopping=true;controllers.forEach(a=>a.abort());await Promise.all(tasks);}
 });
 await run('Redis 15s pause under 2000 reads degrades and recovers',async()=>{
  const config=await readFile(runtime+'/redis.local.conf','utf8'),password=config.match(/^requirepass (.+)$/m)[1];await exec('redis-cli',['-p',config.match(/^port (\d+)$/m)[1],'CLIENT','PAUSE','15000','ALL'],{env:{...process.env,REDISCLI_AUTH:password}});await until(async()=>(await get('/api/backend')).redis.healthy===false,5000);
  const r=await load({requests:2000,concurrency:100});assert.equal(r.errorCount,0);const recovered=performance.now();await until(async()=>(await get('/api/backend')).redis.healthy===true,20000);return {...r,recoveryWaitMs:performance.now()-recovered};
 });
 await run('private engine frozen: 100 reads fail closed then recover',async()=>{
  process.kill(pids.engine,'SIGSTOP');const start=performance.now();let r;
  try{await delay(1200);r=await load({requests:100,concurrency:100});assert.equal(r.statuses[503],100);assert.equal(r.statuses[200]||0,0);}finally{process.kill(pids.engine,'SIGCONT');}
  await until(()=>get());return {statuses:r.statuses,p50Ms:r.p50Ms,p95Ms:r.p95Ms,p99Ms:r.p99Ms,maxMs:r.maxMs,totalFreezeAndRecoveryMs:performance.now()-start,noStaleSuccess:true};
 });
 await run('fork RPC frozen: state fails closed and resumes canonically',async()=>{
  const before=await get();process.kill(pids.anvil,'SIGSTOP');let r;const start=performance.now();
  try{await delay(1500);r=await load({requests:50,concurrency:50});assert.equal(r.statuses[503],50);}finally{process.kill(pids.anvil,'SIGCONT');}
  const s=await until(()=>get());assert.equal(s.metrics.cashInvariant,true);assert.equal(s.chainEpoch,before.chainEpoch);return {statuses:r.statuses,wallMs:r.wallMs,recoveryTotalMs:performance.now()-start,epochUnchanged:true};
 });
 await run('SQLite write lock: bounded failure, integrity and recovery',async()=>{
  const lock=spawn('python3',['-u','-c',"import sqlite3,time,sys;c=sqlite3.connect(sys.argv[1]);c.execute('BEGIN IMMEDIATE');print('LOCKED',flush=True);time.sleep(8);c.rollback();c.close()",runtime+'/app.sqlite3'],{stdio:['ignore','pipe','pipe']});await new Promise((resolve,reject)=>{lock.stdout.once('data',resolve);lock.once('error',reject);});const start=performance.now();let status;
  try{await action('price',{market:1,amount:'86001'},2);const r=await fetch(base+'/api/state',{signal:AbortSignal.timeout(10000)});status=r.status;const body=await r.json();assert.equal(status,503);assert.equal(body.stale,true);}finally{await new Promise(resolve=>{if(lock.exitCode!==null)resolve();else lock.once('exit',resolve);});}
  const s=await until(()=>get());assert.equal(s.markets[0].price,E.parseEther('86001').toString());const integrity=(await exec('python3',['-c',"import sqlite3,sys;print(sqlite3.connect(sys.argv[1]).execute('PRAGMA quick_check').fetchone()[0])",runtime+'/app.sqlite3'])).stdout.trim();assert.equal(integrity,'ok');return {duringLockStatus:status,lockAndRecoveryMs:performance.now()-start,integrity};
 });
 const U=1000000n,W=10n**18n;let nonce=BigInt(Date.now())*10000n;
 async function now(){return Number(BigInt((await provider.send('eth_getBlockByNumber',['latest',false])).timestamp));}
 async function advance(seconds=3){await provider.send('evm_increaseTime',[seconds]);await provider.send('evm_mine',[]);}
 async function tx(actor,key,fn,args=[]){
  const hash=await provider.send('eth_sendTransaction',[{from:wallets[actor].address,to:c[key].target,data:c[key].interface.encodeFunctionData(fn,args),gas:'0x16e360',gasPrice:'0x77359400',nonce:'0x'+(await allocateNonce(actor)).toString(16)}]);
  // Never ask the fork source for a pending/unknown receipt: await local inclusion first.
  await until(async()=>{const t=await provider.send('eth_getTransactionByHash',[hash]);return t?.blockNumber;},20000);
  const raw=await provider.send('eth_getTransactionReceipt',[hash]),r={...raw,hash,status:Number(BigInt(raw.status)),gasUsed:BigInt(raw.gasUsed)};
  if(r.status!==1){let reason;try{await provider.send('eth_call',[{from:wallets[actor].address,to:c[key].target,data:c[key].interface.encodeFunctionData(fn,args)},raw.blockNumber]);}catch(e){reason=e.shortMessage||e.message;}const e=Error('Mined revert '+fn+': '+reason);e.receipt=r;throw e;}return r;
 }
 async function order(actor,{market=1,margin=U,leverage=2,isLong=true,positionId=0n,nonceValue}={}){return {user:wallets[actor].address,market,margin:positionId?0n:margin,leverage:positionId?0:leverage,isLong,positionId,priceLimit:positionId?!isLong?10n**36n:1n:isLong?10n**36n:1n,nonce:nonceValue??nonce++,deadline:await now()+20};}
 async function attempted(actor,fn,args){try{const r=await tx(actor,'exchange',fn,args);return {status:1,hash:r.hash,gas:Number(r.gasUsed)};}catch(e){if(e.receipt)return {status:0,hash:e.receipt.hash,gas:Number(e.receipt.gasUsed)};throw e;}}
 await run('32 identical nonces, 32 executions and 32 cancels: exactly once',()=>checkpoint(async()=>{
  const actors=Array.from({length:32},(_,i)=>E.HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,"m/44'/60'/0'/0/"+(i+10)).connect(provider));
  await writeFile(runtime+'/qa-zero-accounts.local.json',JSON.stringify(actors.map(w=>w.address))+'\n',{mode:0o600});
  await Promise.all(actors.map(w=>provider.send('anvil_setBalance',[w.address,'0x3635c9adc5dea00000'])));
  const original=await order(6,{nonceValue:nonce++}),owner=new E.Wallet(wallets[6].privateKey),types={Order:[['user','address'],['market','uint32'],['positionId','uint256'],['margin','uint128'],['leverage','uint32'],['isLong','bool'],['priceLimit','uint256'],['nonce','uint256'],['deadline','uint64']].map(([name,type])=>({name,type}))};
  const signature=await owner.signTypedData({name:'Robinhood Synthetic Protocol',version:'1',chainId:31337,verifyingContract:c.exchange.target},types,original);
  const before=await c.exchange.balances(owner.address),id=await c.exchange.nextOrder();
  async function storm(fn,args,nonceValue){return Promise.all(actors.map(async w=>{const raw=await w.signTransaction({to:c.exchange.target,data:c.exchange.interface.encodeFunctionData(fn,args),gasLimit:1500000,gasPrice:2000000000,chainId:31337,nonce:nonceValue,type:0});const hash=await provider.send('eth_sendRawTransaction',[raw]);await until(async()=>{const t=await provider.send('eth_getTransactionByHash',[hash]);return t?.blockNumber;});const r=await provider.send('eth_getTransactionReceipt',[hash]);let reason;if(r.status==='0x0'){try{await provider.send('eth_call',[{from:w.address,to:c.exchange.target,data:c.exchange.interface.encodeFunctionData(fn,args)},r.blockNumber]);}catch(e){reason=e.shortMessage||e.message;}}return {hash,status:Number(BigInt(r.status)),gas:Number(BigInt(r.gasUsed)),reason};}));}
  const replay=await storm('requestBySig',[original,owner.address,signature],0);assert.equal(replay.filter(r=>r.status===1).length,1,JSON.stringify(replay.slice(0,3)));assert.equal(await c.exchange.balances(owner.address),before-U);
  await advance();await tx(2,'oracle','publish',[1,80000n*W]);const position=await c.exchange.nextPosition();const execution=await storm('execute',[id],1);assert.equal(execution.filter(r=>r.status===1).length,1);assert.equal(await c.exchange.nextPosition(),position+1n);
  const cancelId=await c.exchange.nextOrder(),cancelOrder=await order(6);assert.equal(await c.exchange.nonceUsed(owner.address,cancelOrder.nonce),false);await tx(6,'exchange','request',[cancelOrder]);await advance(25);
  const cancelled=await storm('cancel',[cancelId],2);assert.equal(cancelled.filter(r=>r.status===1).length,1);assert.equal(await c.exchange.cashInvariant(),true);
  return {independentRawSignedWallets:32,replay:{attempts:32,accepted:1,reverted:31},execute:{attempts:32,accepted:1,reverted:31},expiredCancel:{attempts:32,accepted:1,reverted:31},exactBalanceAndPositionAccounting:true,gas:gasStats([...replay,...execution,...cancelled].map(r=>r.gas))};
 }));
 await run('200 real orders across 10 actors: fill/cancel and custody reconciliation',()=>checkpoint(async()=>{
  for(let actor=0;actor<10;actor++){await tx(actor,'collateral','approve',[c.exchange.target,100n*U]);await tx(actor,'exchange','deposit',[100n*U]);}
  const first=await c.exchange.nextOrder(),positions=await c.exchange.nextPosition(),initialPending=await c.exchange.pendingOpenCount(),gas=[],requestedOrders=[];const t=performance.now();
  for(let batch=0;batch<20;batch++)await Promise.all(Array.from({length:10},async(_,actor)=>{const r=await tx(actor,'exchange','request',[await order(actor,{isLong:actor%2===0})]);gas.push(Number(r.gasUsed));const event=r.logs.map(l=>{try{return c.exchange.interface.parseLog(l);}catch{return null;}}).find(e=>e?.name==='OrderRequested');assert(event);requestedOrders.push({id:event.args[0],actor});}));
  const requested=performance.now();await advance();await tx(2,'oracle','publish',[1,80000n*W]);
  requestedOrders.sort((a,b)=>a.id<b.id?-1:1);for(let offset=0;offset<200;offset+=10)await Promise.all(requestedOrders.slice(offset,offset+10).map((o,i)=>tx(o.actor,'exchange',(offset+i)%2?'cancel':'execute',[o.id])));
  assert.equal(await c.exchange.nextPosition(),positions+100n);assert.equal(await c.exchange.pendingOpenCount(),initialPending);assert.equal(await c.exchange.cashInvariant(),true);assert.equal(await c.collateral.balanceOf(c.exchange.target),await c.exchange.accountedAssets());const expected=Number(await c.exchange.openCount()),catchupStart=performance.now();const s=await until(async()=>{const v=await get();return v.positions.length===expected&&Number(v.metrics.openCount)===expected?v:false;});assert.equal(s.metrics.cashInvariant,true);
  return {indexCatchupMs:performance.now()-catchupStart,actors:10,requests:200,filled:100,cancelled:100,requestWallMs:requested-t,totalWallMs:performance.now()-t,requestGas:gasStats(gas),indexedPositions:s.positions.length,custodyMatchesLedger:true};
 }));
 await run('10x price shock, 10 simultaneous large winners and $5m/day global cap',()=>checkpoint(async()=>{
  const ids=[];for(let actor=0;actor<10;actor++){await tx(5,'collateral','mint',[wallets[actor].address,100000n*U]);await tx(actor,'collateral','approve',[c.exchange.target,100000n*U]);await tx(actor,'exchange','deposit',[100000n*U]);const id=await c.exchange.nextOrder();await tx(actor,'exchange','request',[await order(actor,{margin:100000n*U,leverage:100})]);ids.push(id);}
  await advance();await tx(2,'oracle','publish',[1,80000n*W]);const positions=[];for(let i=0;i<10;i++){positions.push(await c.exchange.nextPosition());await tx(3,'exchange','execute',[ids[i]]);}
  await advance();const closeIds=[];for(let i=0;i<10;i++){closeIds.push(await c.exchange.nextOrder());await tx(i,'exchange','request',[await order(i,{positionId:positions[i]})]);}
  await advance();await tx(2,'oracle','publish',[1,800000n*W]);await Promise.all(closeIds.map(id=>tx(3,'exchange','execute',[id])));
  const remaining=await c.exchange.dailyPayoutRemaining(),queued=await c.exchange.totalQueued(),house=await c.exchange.houseCash();assert.equal(remaining,0n);assert(queued>0n);assert.equal(await c.exchange.cashInvariant(),true);assert.equal(await c.collateral.balanceOf(c.exchange.target),await c.exchange.accountedAssets());
  const before=queued;await tx(3,'exchange','harvest',[100]);assert.equal(await c.exchange.totalQueued(),before);return {winners:10,marginPerWinnerUsd:100000,leverage:100,entryUsd:80000,exitUsd:800000,dailyLimitUsd:5000000,remaining:String(remaining),queuedUsd:Number(queued)/1e6,houseCashUsd:Number(house)/1e6,sameDayHarvestCannotBypassCap:true,custodyMatchesLedger:true,solvencyWarning:queued>house};
 }));
 await run('index lifetime boundary and cold catch-up',()=>checkpoint(async()=>{
  await tx(6,'collateral','approve',[c.exchange.target,100n*U]);await tx(6,'exchange','deposit',[100n*U]);const target=BigInt(process.env.QA_ORDER_TARGET||2002);let batches=0;const start=performance.now();
  while(await c.exchange.nextOrder()<target){const n=await c.exchange.nextOrder();await tx(6,'exchange','request',[await order(6)]);await tx(6,'exchange','cancel',[n]);batches++;if(batches%500===0)console.log('BOUNDARY_PROGRESS',batches);}
  const r=await fetch(base+'/api/state',{signal:AbortSignal.timeout(15000)}),body=await r.json();let cold;
  if(process.env.QA_EXPECT_INDEX_FIXED==='1'){
   assert.equal(r.status,200,JSON.stringify(body));const id=(await action('snapshot')).id;await action('restore',{id});const coldStart=performance.now(),failures=[];
   const state=await until(async()=>{const r=await fetch(base+'/api/state',{signal:AbortSignal.timeout(15000)}),j=await r.json();if(!r.ok){failures.push({status:r.status,error:j.error});return false;}assert.equal(j.indexing.ready,true);return j;},90000);
   assert.equal(state.orders.length,0);assert.equal(state.metrics.cashInvariant,true);assert.equal(state.indexing.ordersScanned,Number(target-1n));cold={catchupMs:performance.now()-coldStart,loadingResponses:failures,indexing:state.indexing,unclosedOrders:state.orders.length};
  }
  return {generatedRequestCancelPairs:batches,nextOrder:String(await c.exchange.nextOrder()),wallMs:performance.now()-start,httpStatus:r.status,error:body.error||null,knownScaleLimit:r.status!==200,cold};
 }));
}catch(e){report.fatal={error:e.message,stack:e.stack};console.error(e);process.exitCode=1;}
finally{try{if(rootCheckpoint){await provider.send('anvil_dropAllTransactions',[]);await action('restore',{id:rootCheckpoint});}}catch(e){report.restoreError=e.message;}clearInterval(sampler);report.environment.peaks=peaks;report.completedAt=new Date().toISOString();await flush();provider.destroy();}
if(report.failures.length)process.exitCode=1;
