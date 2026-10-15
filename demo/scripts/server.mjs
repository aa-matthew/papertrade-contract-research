import http from 'node:http';
import {sharedSession} from './shared-session.mjs';
const sharedMode=process.env.LAB_SHARED==='1';
import {createShowcase} from './showcase.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {E,read,save,connected,dir,json,wait,rpcMetrics} from './shared.mjs';
const provider=await connected(),deployment=await read('deployment.local.json'),fork=await read('fork.local.json'),wallets=await read('wallets.local.json'),build=await read('compiled.local.json');
const names={exchange:'ReconstructedLabExchange',collateral:'LabCollateral',oracle:'LabOracle',token:'ProtocolToken',staking:'ProtocolStaking',governance:'ProtocolTimelock'},c={};
const signers=await Promise.all(wallets.map(w=>provider.getSigner(w.address)));
for(const [key,address]of Object.entries(deployment.contracts)){if(E.keccak256(await provider.getCode(address))!==deployment.runtimeHashes[key])throw Error('Deployment code mismatch: '+key);c[key]=new E.Contract(address,build.contracts[names[key]].abi,provider);}
let journal=await read('journal.local.json'),history=await read('prices.local.json'),operations=[];try{operations=await read('operations.local.json');}catch{}
let indexing={ready:true};
let chain=Promise.resolve(),heartbeat=!sharedMode,revision=0,chainEpoch=0,mutating=false,lastHead,headMemo,stateFlight,cachedSnapshot,projection,reconcilePending=true;
const engineId=randomBytes(12).toString('hex'),engineStats={collections:0,snapshotHits:0,positionReads:0,orderReads:0};
const engineToken=process.env.ENGINE_TOKEN;if(!engineToken)throw Error('Start through npm run up --prefix demo (private engine token required)');
const checkpoints=new Map();
function serial(fn){const run=async()=>{mutating=true;revision++;headMemo=null;try{return await fn();}finally{revision++;mutating=false;headMemo=null;}};const next=chain.then(run,run);chain=next.catch(()=>{});return next;}
const publicActors=wallets.map(({privateKey,...w})=>w);
const prices=Object.fromEntries(deployment.markets.map(m=>[m.id,E.parseEther(String(history[m.id]?.at(-1)?.price??m.price))]));
function index(n){const i=Number(n);if(!Number.isInteger(i)||i<0||i>=10)throw Error('Choose one of 10 actors');return i;}
function units(x,dec=6){if(!/^\d+(\.\d+)?$/.test(String(x)))throw Error('Enter a positive decimal amount');return E.parseUnits(String(x),dec);}
async function block(){return provider.send('eth_getBlockByNumber',['latest',false]);}
async function headMeta(){
 if(headMemo&&Date.now()-headMemo.at<100)return headMemo.value;
 const b=await block();
 if(lastHead&&lastHead.hash!==b.hash){const previous=await provider.send('eth_getBlockByNumber',[lastHead.number,false]);if(!previous||previous.hash!==lastHead.hash){chainEpoch++;projection=null;cachedSnapshot=null;reconcilePending=true;}}
 lastHead=b;const value={version:`${engineId}:${chainEpoch}:${revision}:${b.hash}`,engineId,chainEpoch,revision,block:Number(BigInt(b.number)),blockHash:b.hash,head:b,mutating,indexing,showcase:showcase.status(),heartbeat,testing:checkpoints.size>0};headMemo={at:Date.now(),value};return value;
}
async function timestamp(){return Number((await block()).timestamp);}
async function tx(actor,key,fn,args=[],silent=false){
 const contract=c[key].connect(signers[index(actor)]),method=contract.getFunction(fn),estimate=await method.estimateGas(...args),r=await wait(method(...args,{gasLimit:estimate+estimate/5n+10000n}));
 const events=[];for(const log of r.logs){for(const [name,con]of Object.entries(c)){if(log.address.toLowerCase()!==con.target.toLowerCase())continue;try{const e=con.interface.parseLog(log);if(e)events.push({contract:name,name:e.name,args:Array.from(e.args).map(a=>typeof a==='bigint'?String(a):a)});}catch{}}}
 if(!silent){journal.unshift({hash:r.hash,block:r.blockNumber,actor:index(actor),contract:key,method:fn,args:JSON.parse(json(args)),gasUsed:String(r.gasUsed),status:r.status,at:new Date().toISOString(),events});journal=journal.slice(0,500);await save('journal.local.json',journal);}
 return {hash:r.hash,block:r.blockNumber,blockHash:r.blockHash,events};
}
async function refresh(market,silent=true){return tx(2,'oracle','publish',[market,prices[market]],silent);}
async function setPrice(actor,market,value){const v=units(value,18);const result=await tx(actor,'oracle','publish',[market,v]);prices[market]=v;history[market]??=[];history[market].push({hash:result.hash,block:result.block,blockHash:result.blockHash,time:(await timestamp())*1000,price:Number(E.formatEther(v))});history[market]=history[market].slice(-300);await save('prices.local.json',history);return result;}
async function advance(seconds){if(!Number.isInteger(seconds)||seconds<1||seconds>31*86400)throw Error('Time jump must be 1 second to 31 days');await provider.send('evm_increaseTime',[seconds]);await provider.send('evm_mine',[]);}
async function execute(actor,id){const q=await c.exchange.pendingOrders(id);const t=await timestamp();if(Number(q.eligibleAt)>t)await advance(Number(q.eligibleAt)-t);await refresh(Number(q.order.market));return tx(actor,'exchange','execute',[id]);}
const orderTypes={Order:[['user','address'],['market','uint32'],['positionId','uint256'],['margin','uint128'],['leverage','uint32'],['isLong','bool'],['priceLimit','uint256'],['nonce','uint256'],['deadline','uint64']].map(([name,type])=>({name,type}))};
async function request(actor,a,positionId=0n){
 let user=wallets[actor].address,market=Number(a.market||1),isLong=a.isLong!==false,margin=units(a.amount||'100'),leverage=Number(a.leverage||20);
 if(positionId){const pos=await c.exchange.positions(positionId);market=Number(pos.market);isLong=pos.isLong;margin=0n;leverage=0;await advance(3);}
 if(a.session){user=wallets[6].address;if(actor!==9)throw Error('Session orders must be signed by actor 9');}
 const buy=positionId?!isLong:isLong,t=await timestamp(),risk=await c.exchange.markets(market);
 const retired=await c.exchange.retiredPrice(market),executionPrice=retired!==0n?retired:prices[market];
 const o={user,market,positionId,margin,leverage,isLong,priceLimit:a.priceLimit?units(a.priceLimit,18):(buy?executionPrice*105n/100n:executionPrice*95n/100n),nonce:BigInt('0x'+randomBytes(16).toString('hex')),deadline:t+Number(risk.delay)+Number(risk.executionWindow)-2};
 let r;
 if(a.session){const key=new E.Wallet(wallets[9].privateKey);const sig=await key.signTypedData({name:'Robinhood Synthetic Protocol',version:'1',chainId:31337,verifyingContract:c.exchange.target},orderTypes,o);r=await tx(actor,'exchange','requestBySig',[o,key.address,sig]);}
 else r=await tx(actor,'exchange','request',[o]);
 const id=r.events.find(e=>e.name==='OrderRequested').args[0];
 if(a.auto!==false){try{await advance(3);await execute(3,id);}catch(e){throw Error('Order #'+id+' committed; execution failed: '+(e.shortMessage||e.message)+'. Retry or cancel it in Orders.');}}
 return {orderId:id,...r};
}
async function action(a){
 if(sharedMode)throw Error('Server signing and checkpoint actions disabled in shared LAN mode');
 const actor=index(a.actor),id=String(a.id||'0'),amount=()=>units(a.amount||'0');
 switch(a.action){
 case 'presentationHistory':for(const m of deployment.markets){history[m.id]=history[m.id]?.slice(-1)||[];}await save('prices.local.json',history);return {cleared:true};
 case 'snapshot':{
 const id=await provider.send('evm_snapshot',[]);checkpoints.set(id,{journal:structuredClone(journal),history:structuredClone(history),operations:structuredClone(operations),prices:{...prices},heartbeat});return {id};}
 case 'restore':{
 const saved=checkpoints.get(a.id);if(!saved)throw Error('Unknown local checkpoint');if(!await provider.send('evm_revert',[a.id]))throw Error('Checkpoint no longer available');
 chainEpoch++;projection=null;cachedSnapshot=null;lastHead=null;headMemo=null;reconcilePending=false;
 journal=saved.journal;history=saved.history;operations=saved.operations;Object.assign(prices,saved.prices);heartbeat=saved.heartbeat;checkpoints.delete(a.id);
 await save('journal.local.json',journal);await save('prices.local.json',history);await save('operations.local.json',operations);return {restored:a.id};}
 case 'deposit':await tx(actor,'collateral','approve',[c.exchange.target,amount()]);return tx(actor,'exchange','deposit',[amount()]);
 case 'withdraw':return tx(actor,'exchange','withdraw',[amount(),a.recipient||wallets[actor].address]);
 case 'faucet':return tx(5,'collateral','mint',[wallets[actor].address,amount()]);
 case 'open':return request(actor,a);
 case 'close':return request(actor,a,BigInt(id));
 case 'closeAll':{
 const user=wallets[actor===9?6:actor].address,last=await c.exchange.nextPosition(),closed=[];
 for(let i=1n;i<last;i++){const pos=await c.exchange.positions(i);if(pos.user.toLowerCase()===user.toLowerCase()){closed.push(await request(actor,{...a,session:actor===9},i));}}
 return {closed:closed.length};}
 case 'cancel':return tx(actor,'exchange','cancel',[id]);
 case 'execute':return execute(actor,id);
 case 'liquidate':{const pos=await c.exchange.positions(id);await refresh(Number(pos.market));return tx(actor,'exchange','liquidate',[id]);}
 case 'seed':await tx(actor,'collateral','approve',[c.exchange.target,amount()]);return tx(actor,'exchange','seedLiquidity',[amount()]);
 case 'stake':await tx(actor,'token','approve',[c.staking.target,units(a.amount,18)]);return tx(actor,'staking','stake',[units(a.amount,18)]);
 case 'unstake':return tx(actor,'staking','unstake',[units(a.amount,18)]);
 case 'claim':return tx(actor,'staking','claim',[]);
 case 'harvest':return tx(actor,'exchange','harvest',[Number(a.entries||100)]);
 case 'fees':return tx(actor,'exchange','pushFees',[]);
 case 'surplus':return tx(actor,'exchange','sweepSurplus',[]);
 case 'price':return setPrice(actor,Number(a.market||1),a.amount);
 case 'pause':return tx(actor,'exchange','setOpensPaused',[a.flag!==false]);
 case 'oraclePause':return tx(actor,'oracle','setPaused',[a.flag!==false]);
 case 'retire':await refresh(Number(a.market||1));return tx(actor,'exchange','retireMarket',[Number(a.market||1)]);
 case 'session':return tx(actor,'exchange','setSession',[a.key||wallets[9].address,await timestamp()+Number(a.hours||24)*3600,amount()]);
 case 'revoke':return tx(actor,'exchange','revokeSession',[a.key||wallets[9].address]);
 case 'advance':await advance(Number(a.seconds||86400));if(heartbeat)for(const m of deployment.markets)await refresh(m.id);return {advanced:Number(a.seconds||86400)};
 case 'heartbeat':heartbeat=!!a.flag;return {heartbeat};
 case 'governanceSchedule':{
 const key=a.contract||'exchange';if(!c[key])throw Error('Unknown target');const data=c[key].interface.encodeFunctionData(a.fn,a.args||[]),salt=E.hexlify(randomBytes(32)),pre=E.ZeroHash,delay=await c.governance.getMinDelay(),target=c[key].target;
 const opId=await c.governance.hashOperation(target,0,data,pre,salt),result=await tx(actor,'governance','schedule',[target,0,data,pre,salt,delay]);operations.unshift({id:opId,target,key,fn:a.fn,args:a.args||[],data,pre,salt,at:await timestamp()+Number(delay)});await save('operations.local.json',operations);return {operationId:opId,...result};}
 case 'governanceExecute':{const op=operations.find(o=>o.id===a.id);if(!op)throw Error('Unknown scheduled operation');return tx(actor,'governance','execute',[op.target,0,op.data,op.pre,op.salt]);}
 case 'governanceCancel':return tx(actor,'governance','cancel',[id]);
 case 'contract':{
 const key=a.contract;if(!c[key])throw Error('Unknown contract');const fragment=c[key].interface.getFunction(a.fn);if(!fragment)throw Error('Unknown ABI function');
 if(['view','pure'].includes(fragment.stateMutability))return {result:await c[key][a.fn](...(a.args||[]))};
 return tx(actor,key,a.fn,a.args||[]);}
 default:throw Error('Unknown action');
 }
}
async function collectState(b,version){
 if(reconcilePending){
 const receipts=new Map();const hashes=new Set([...journal.map(j=>j.hash),...Object.values(history).flat().filter(q=>q.hash).map(q=>q.hash)]);await Promise.all([...hashes].map(async hash=>receipts.set(hash,await provider.send('eth_getTransactionReceipt',[hash]))));
 journal=journal.filter(j=>{const r=receipts.get(j.hash);return r&&Number(BigInt(r.blockNumber))<=Number(BigInt(b.number))&&r.status==='0x1';});
 for(const m of deployment.markets){const q=await c.oracle.quotes(m.id,{blockTag:Number(BigInt(b.number))});prices[m.id]=q.value;history[m.id]=(history[m.id]||[]).filter(q=>q.hash?receipts.has(q.hash)&&receipts.get(q.hash)!==null&&Number(BigInt(receipts.get(q.hash).blockNumber))<=Number(BigInt(b.number)):true);}
 await save('journal.local.json',journal);await save('prices.local.json',history);reconcilePending=false;
 }
 engineStats.collections++;const blockTag=Number(BigInt(b.number)),opts={blockTag};
 const fields=['houseCash','totalBalances','lockedMargin','stakerFees','developerFees','totalQueued','openCount','pendingOpenCount','opensPaused','queueHead','queueTail','cashInvariant','dailyPayoutRemaining','DAILY_PAYOUT_LIMIT','trackedLpWad','tailProgressWad','houseCap','owner','guardian','developer'];
 const vals=await Promise.all(fields.map(f=>c.exchange[f](opts)));const metrics=Object.fromEntries(fields.map((f,i)=>[f,vals[i]]));
 const accounts=await Promise.all(wallets.map(async w=>({index:w.index,address:w.address,name:w.name,role:w.role,native:await provider.getBalance(w.address,blockTag),wallet:await c.collateral.balanceOf(w.address,opts),available:await c.exchange.balances(w.address,opts),queued:await c.exchange.queued(w.address,opts),part:await c.token.balanceOf(w.address,opts),staked:await c.staking.staked(w.address,opts),rewards:await c.staking.pending(w.address,opts)})));
 const [np,no]=await Promise.all([c.exchange.nextPosition(opts),c.exchange.nextOrder(opts)]);
 if(!projection||projection.epoch!==chainEpoch||np<projection.nextPosition||no<projection.nextOrder)projection={epoch:chainEpoch,nextPosition:1n,nextOrder:1n,positions:new Map(),orders:new Map()};
 const positionEnd=np<projection.nextPosition+250n?np:projection.nextPosition+250n,orderEnd=no<projection.nextOrder+250n?no:projection.nextOrder+250n;
 const positionIds=new Set(projection.positions.keys());for(let n=projection.nextPosition;n<positionEnd;n++)positionIds.add(Number(n));
 const orderIds=new Set(projection.orders.keys());for(let n=projection.nextOrder;n<orderEnd;n++)orderIds.add(Number(n));
 engineStats.positionReads+=positionIds.size;engineStats.orderReads+=orderIds.size;
 const positions=(await Promise.all([...positionIds].map(async n=>{const v=await c.exchange.positions(n,opts);return{id:n,user:v.user,market:Number(v.market),leverage:Number(v.leverage),isLong:v.isLong,margin:v.margin,entry:v.entry,openedAt:v.openedAt,bustBufferBps:Number(v.bustBufferBps),impact:{base:v.impact.base,rate:v.impact.rate,position:v.impact.position,referenceUsd:v.impact.referenceUsd}};}))).filter(x=>x.user!==E.ZeroAddress);
 const orders=(await Promise.all([...orderIds].map(async id=>{const v=await c.exchange.pendingOrders(id,opts),o=v.order;return{id,user:o.user,market:Number(o.market),positionId:o.positionId,margin:o.margin,leverage:Number(o.leverage),isLong:o.isLong,deadline:o.deadline,priceLimit:o.priceLimit,eligibleAt:v.eligibleAt,done:v.done,signer:v.signer};}))).filter(o=>!o.done);
 projection.positions=new Map(positions.map(p=>[p.id,p]));projection.orders=new Map(orders.map(o=>[o.id,o]));projection.nextPosition=positionEnd;projection.nextOrder=orderEnd;
 indexing={ready:positionEnd===np&&orderEnd===no,positionsScanned:Number(positionEnd-1n),positionsTotal:Number(np-1n),ordersScanned:Number(orderEnd-1n),ordersTotal:Number(no-1n),pageSize:250};
 if(!indexing.ready){const error=Error(`Indexing canonical history: positions ${indexing.positionsScanned}/${indexing.positionsTotal}, orders ${indexing.ordersScanned}/${indexing.ordersTotal}`);error.status=503;throw error;}
 const claims=await Promise.all(Array.from({length:Math.min(50,Number(BigInt(metrics.queueTail)-BigInt(metrics.queueHead)))},async(_,i)=>{const id=BigInt(metrics.queueHead)+BigInt(i),q=await c.exchange.claims(id,opts);return {id,user:q.user,amount:q.amount};}));
 const markets=await Promise.all(deployment.markets.map(async m=>{const q=await c.oracle.quotes(m.id,opts),risk=await c.exchange.markets(m.id,opts);return{...m,price:q.value,at:q[1],history:history[m.id],longNotional:await c.exchange.longNotional(m.id,opts),shortNotional:await c.exchange.shortNotional(m.id,opts),retiredPrice:await c.exchange.retiredPrice(m.id,opts),enabled:risk.enabled,bustBufferBps:Number(risk.bustBufferBps),maxLeverage:Number(risk.maxLeverage),delay:Number(risk.delay),executionWindow:Number(risk.executionWindow),minMargin:risk.minMargin,maxMargin:risk.maxMargin,sideCap:risk.sideCap,impact:risk.impact};}));
 const session=await c.exchange.sessions(wallets[6].address,wallets[9].address,opts),governanceOps=await Promise.all(operations.map(async op=>({...op,ready:await c.governance.isOperationReady(op.id,opts),done:await c.governance.isOperationDone(op.id,opts),pending:await c.governance.isOperationPending(op.id,opts)})));
 return {indexing,engineId,chainEpoch,stateRevision:revision,stateVersion:version,blockHash:b.hash,showcase:showcase.status(),chainId:31337,rpcUrl:sharedMode?'/rpc':'http://127.0.0.1:9545',shared:sharedMode?lan.status():null,block:blockTag,timestamp:Number(BigInt(b.timestamp)),fork,contracts:deployment.contracts,actors:publicActors,accounts,metrics,markets,positions,orders,claims,journal:journal.slice(0,100),operations:governanceOps,heartbeat,testing:checkpoints.size>0,oraclePaused:await c.oracle.paused(opts),session:{owner:wallets[6].address,key:wallets[9].address,expiry:session.expiry,marginBudget:session.marginBudget},totalSupply:await c.token.totalSupply(opts),actor:6};
}
async function state(actor=6){
 const selected=index(actor);if(!stateFlight){const next=chain.then(async()=>{const meta=await headMeta();if(cachedSnapshot?.stateVersion===meta.version){engineStats.snapshotHits++;return cachedSnapshot;}const value=await collectState(meta.head,meta.version);const canonical=await provider.send('eth_getBlockByNumber',[meta.head.number,false]);if(canonical?.hash!==meta.head.hash){projection=null;cachedSnapshot=null;throw Error('Chain changed during snapshot; retry');}cachedSnapshot=value;return value;});chain=next.catch(()=>{});stateFlight=next.finally(()=>{stateFlight=null;});}
 const value=await stateFlight;return {...value,actor:selected,showcase:showcase.status(),heartbeat,testing:checkpoints.size>0};
}
let scanBusy=false;
async function scanExternal(){if(!sharedMode||scanBusy)return;scanBusy=true;try{
 let cursor;try{cursor=await read('lan-index.local.json');}catch{cursor={block:fork.blockNumber};}
 const head=Number(BigInt((await block()).number)),known=new Set(journal.map(j=>j.hash)),end=Math.min(head,cursor.block+100);
 const blocks=await Promise.all(Array.from({length:Math.max(0,end-cursor.block)},(_,i)=>provider.send('eth_getBlockByNumber',['0x'+(cursor.block+i+1).toString(16),true])));
 const records=(await Promise.all(blocks.flatMap(b=>b.transactions.map(async t=>{
  const key=Object.keys(c).find(k=>c[k].target.toLowerCase()===t.to?.toLowerCase());if(!key||known.has(t.hash))return null;
  const actor=wallets.findIndex(w=>w.address.toLowerCase()===t.from.toLowerCase());if(actor<0)return null;
  const r=await provider.getTransactionReceipt(t.hash);if(!r)return null;
  let call;try{call=c[key].interface.parseTransaction({data:t.input,value:t.value});}catch{}const events=[];
  for(const l of r.logs)for(const[k,con]of Object.entries(c)){if(l.address.toLowerCase()!==con.target.toLowerCase())continue;try{const e=con.interface.parseLog(l);if(e)events.push({contract:k,name:e.name,args:Array.from(e.args).map(v=>typeof v==='bigint'?String(v):v)});}catch{}}
  let operation;
  if(key==='governance'&&call?.name==='schedule'){const [target,value,data,pre,salt,delay]=call.args;const name=Object.keys(c).find(k=>c[k].target.toLowerCase()===target.toLowerCase());let decoded;try{decoded=c[name].interface.parseTransaction({data});}catch{}operation={id:await c.governance.hashOperation(target,value,data,pre,salt),target,key:name||'unknown',fn:decoded?.name||'unknown',args:JSON.parse(json(decoded?.args||[])),data,pre,salt,at:Number(BigInt(b.timestamp))+Number(delay)};}
  return {operation,hash:r.hash,block:r.blockNumber,blockHash:r.blockHash,actor,contract:key,method:call?.name||'external',args:[],gasUsed:String(r.gasUsed),status:r.status,at:new Date(Number(BigInt(b.timestamp))*1000).toISOString(),events,external:true};
 })))).filter(Boolean);
 if(!records.length){await save('lan-index.local.json',{block:end});return;}
 await serial(async()=>{
  for(const r of records){if(r.operation&&!operations.some(o=>o.id===r.operation.id))operations.unshift(r.operation);if(journal.some(j=>j.hash===r.hash))continue;journal.unshift(r);
   for(const e of r.events)if(e.name==='QuotePublished'){const [m,value,at]=e.args;prices[m]=BigInt(value);history[m]??=[];if(!history[m].some(q=>q.hash===r.hash))history[m].push({hash:r.hash,block:r.block,blockHash:r.blockHash,time:Number(at)*1000,price:Number(E.formatEther(value))});history[m]=history[m].slice(-300);}
  }
  journal.sort((a,b)=>b.block-a.block);journal=journal.slice(0,500);await save('journal.local.json',journal);await save('prices.local.json',history);await save('operations.local.json',operations);await save('lan-index.local.json',{block:end});
 });
 }catch(e){console.error('Shared receipt index:',e.message);}finally{scanBusy=false;}}
setInterval(scanExternal,2000).unref();
let previousShowcase;try{previousShowcase=await read('showcase.local.json');}catch{}
const showcase=createShowcase({state:async()=>JSON.parse(json(await state())),action,serial,previous:previousShowcase});
const lan=sharedMode?sharedSession({E,provider,c,wallets,tx,setPrice,serial,read,save,getOperations:()=>operations}):null;
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.md':'text/plain'};
function respond(res,status,data,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});res.end(type==='application/json'?json(data):data);}
const server=http.createServer(async(req,res)=>{
 try{
 const host=req.headers.host;if(!['127.0.0.1:4174','localhost:4174'].includes(host))return respond(res,403,{error:'Loopback host required'});
 if(req.headers['x-engine-token']!==engineToken)return respond(res,403,{error:'Private contract engine'});
 const origin=req.headers.origin;if(origin&&!['http://127.0.0.1:4173','http://localhost:4173'].includes(origin))return respond(res,403,{error:'Cross-origin request blocked'});
 const url=new URL(req.url,'http://'+host);
 if(req.method==='GET'&&url.pathname==='/internal/meta')return respond(res,200,await headMeta());
 if(req.method==='GET'&&url.pathname==='/internal/stats')return respond(res,200,{...engineStats,rpc:rpcMetrics,engineId,revision,chainEpoch,mutating});
 if(req.method==='GET'&&url.pathname==='/api/state')return respond(res,200,await state(url.searchParams.get('actor')||6));
 if(req.method==='GET'&&url.pathname==='/api/abi')return respond(res,200,Object.fromEntries(Object.entries(names).map(([k,n])=>[k,build.contracts[n].abi])));
 if(sharedMode&&url.pathname==='/api/wallets')return respond(res,403,{error:'Wallet keys are distributed privately by the host'});
 if(req.method==='POST'&&['/api/prepare','/rpc'].includes(url.pathname)){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw Error('Request too large');}if(!lan)throw Error('Shared LAN mode required');const args=JSON.parse(raw);return respond(res,200,url.pathname==='/rpc'?await lan.rpc(args):await lan.prepare(args));}
 if(req.method==='GET'&&url.pathname==='/api/wallets'){res.setHeader('Content-Disposition','attachment; filename="LOCAL-TEST-wallets.json"');return respond(res,200,wallets);}
 if(req.method==='GET'&&url.pathname.startsWith('/api/receipt/')){const hash=url.pathname.split('/').at(-1);if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Invalid hash');return respond(res,200,await provider.getTransactionReceipt(hash));}
 if(req.method==='GET'&&url.pathname==='/api/showcase')return respond(res,200,showcase.status());
 if(req.method==='POST'&&['/api/action','/api/showcase'].includes(url.pathname)){
 if(sharedMode)return respond(res,403,{error:'Persistent shared session: connect your wallet; server signing, checkpoints and showcase rollback disabled'});
 if(req.headers['x-lab-request']!=='1')return respond(res,403,{error:'Local UI request header required'});
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw Error('Request too large');}
 const args=JSON.parse(raw);
 if(url.pathname==='/api/showcase'){if(!['start','stop'].includes(args.command))throw Error('Choose start or stop');return respond(res,200,{ok:true,result:args.command==='start'?await showcase.start(args):await showcase.stop()});}
 if(showcase.status().running)return respond(res,409,{error:'Showcase owns a temporary checkpoint. Stop it before manual transactions.'});
 return respond(res,200,{ok:true,result:await serial(()=>action(args))});
 }
 if(req.method!=='GET')return respond(res,405,{error:'Method not allowed'});
 const file=url.pathname==='/'||!path.extname(url.pathname)?'index.html':decodeURIComponent(url.pathname).slice(1);const full=path.resolve(dir,'public',file);if(!full.startsWith(path.join(dir,'public')+path.sep))return respond(res,403,{error:'Forbidden'});
 try{return respond(res,200,await readFile(full),mime[path.extname(full)]||'application/octet-stream');}catch{return respond(res,404,{error:'Not found'});}
 }catch(e){respond(res,e.status||400,{error:e.shortMessage||e.reason||e.message,detail:e.info?.error?.message||e.revert?.args?.[0]||null});}
});
server.listen(4174,'127.0.0.1',()=>console.log('Private ABI/transaction engine ready on loopback 4174'));
setInterval(()=>{if(sharedMode||!heartbeat||showcase.status().running)return;serial(async()=>{for(const m of deployment.markets)await refresh(m.id);}).catch(e=>console.error('Heartbeat:',e.shortMessage||e.message));},10000).unref();
process.on('SIGTERM',async()=>{await lan?.stop();await showcase.stop();await chain;server.close();provider.destroy();process.exit(0);});
