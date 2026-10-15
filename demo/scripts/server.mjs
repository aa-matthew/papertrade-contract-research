import http from 'node:http';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {E,read,save,connected,dir,json,wait} from './shared.mjs';
const provider=await connected(),deployment=await read('deployment.local.json'),fork=await read('fork.local.json'),wallets=await read('wallets.local.json'),build=await read('compiled.local.json');
const names={exchange:'ReconstructedLabExchange',collateral:'LabCollateral',oracle:'LabOracle',token:'ProtocolToken',staking:'ProtocolStaking',governance:'ProtocolTimelock'},c={};
const signers=await Promise.all(wallets.map(w=>provider.getSigner(w.address)));
for(const [key,address]of Object.entries(deployment.contracts)){if(E.keccak256(await provider.getCode(address))!==deployment.runtimeHashes[key])throw Error('Deployment code mismatch: '+key);c[key]=new E.Contract(address,build.contracts[names[key]].abi,provider);}
let journal=await read('journal.local.json'),history=await read('prices.local.json'),operations=[];try{operations=await read('operations.local.json');}catch{}
let chain=Promise.resolve(),heartbeat=true;
const checkpoints=new Map();
function serial(fn){const next=chain.then(fn,fn);chain=next.catch(()=>{});return next;}
const publicActors=wallets.map(({privateKey,...w})=>w);
const prices=Object.fromEntries(deployment.markets.map(m=>[m.id,E.parseEther(String(history[m.id]?.at(-1)?.price??m.price))]));
function index(n){const i=Number(n);if(!Number.isInteger(i)||i<0||i>=10)throw Error('Choose one of 10 actors');return i;}
function units(x,dec=6){if(!/^\d+(\.\d+)?$/.test(String(x)))throw Error('Enter a positive decimal amount');return E.parseUnits(String(x),dec);}
async function block(){return provider.send('eth_getBlockByNumber',['latest',false]);}
async function timestamp(){return Number((await block()).timestamp);}
async function tx(actor,key,fn,args=[],silent=false){
 const contract=c[key].connect(signers[index(actor)]),r=await wait(contract[fn](...args));
 const events=[];for(const log of r.logs){for(const [name,con]of Object.entries(c)){if(log.address.toLowerCase()!==con.target.toLowerCase())continue;try{const e=con.interface.parseLog(log);if(e)events.push({contract:name,name:e.name,args:Array.from(e.args).map(a=>typeof a==='bigint'?String(a):a)});}catch{}}}
 if(!silent){journal.unshift({hash:r.hash,block:r.blockNumber,actor:index(actor),contract:key,method:fn,args:JSON.parse(json(args)),gasUsed:String(r.gasUsed),status:r.status,at:new Date().toISOString(),events});journal=journal.slice(0,500);await save('journal.local.json',journal);}
 return {hash:r.hash,events};
}
async function refresh(market,silent=true){return tx(2,'oracle','publish',[market,prices[market]],silent);}
async function setPrice(actor,market,value){const v=units(value,18);const result=await tx(actor,'oracle','publish',[market,v]);prices[market]=v;history[market]??=[];history[market].push({time:(await timestamp())*1000,price:Number(E.formatEther(v))});history[market]=history[market].slice(-300);await save('prices.local.json',history);return result;}
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
 const actor=index(a.actor),id=String(a.id||'0'),amount=()=>units(a.amount||'0');
 switch(a.action){
 case 'snapshot':{
 const id=await provider.send('evm_snapshot',[]);checkpoints.set(id,{journal:structuredClone(journal),history:structuredClone(history),operations:structuredClone(operations),prices:{...prices},heartbeat});return {id};}
 case 'restore':{
 const saved=checkpoints.get(a.id);if(!saved)throw Error('Unknown local checkpoint');if(!await provider.send('evm_revert',[a.id]))throw Error('Checkpoint no longer available');
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
async function state(actor=6){
 const b=await block(),blockTag=Number(BigInt(b.number)),opts={blockTag};
 const fields=['houseCash','totalBalances','lockedMargin','stakerFees','developerFees','totalQueued','openCount','pendingOpenCount','opensPaused','queueHead','queueTail','cashInvariant','dailyPayoutRemaining','DAILY_PAYOUT_LIMIT','trackedLpWad','tailProgressWad','houseCap','owner','guardian','developer'];
 const vals=await Promise.all(fields.map(f=>c.exchange[f](opts)));const metrics=Object.fromEntries(fields.map((f,i)=>[f,vals[i]]));
 const accounts=await Promise.all(wallets.map(async w=>({index:w.index,address:w.address,name:w.name,role:w.role,native:await provider.getBalance(w.address,blockTag),wallet:await c.collateral.balanceOf(w.address,opts),available:await c.exchange.balances(w.address,opts),queued:await c.exchange.queued(w.address,opts),part:await c.token.balanceOf(w.address,opts),staked:await c.staking.staked(w.address,opts),rewards:await c.staking.pending(w.address,opts)})));
 const [np,no]=await Promise.all([c.exchange.nextPosition(opts),c.exchange.nextOrder(opts)]);if(np>1000n||no>2000n)throw Error('Lab indexing limit reached; restart a fresh lab or extend the indexer');
 const positions=(await Promise.all(Array.from({length:Number(np)-1},async(_,i)=>{const n=i+1,v=await c.exchange.positions(n,opts);return{id:n,user:v.user,market:Number(v.market),leverage:Number(v.leverage),isLong:v.isLong,margin:v.margin,entry:v.entry,openedAt:v.openedAt,bustBufferBps:Number(v.bustBufferBps),impact:{base:v.impact.base,rate:v.impact.rate,position:v.impact.position,referenceUsd:v.impact.referenceUsd}};}))).filter(x=>x.user!==E.ZeroAddress);
 const orders=(await Promise.all(Array.from({length:Number(no)-1},async(_,i)=>{const id=i+1,v=await c.exchange.pendingOrders(id,opts),o=v.order;return{id,user:o.user,market:Number(o.market),positionId:o.positionId,margin:o.margin,leverage:Number(o.leverage),isLong:o.isLong,deadline:o.deadline,priceLimit:o.priceLimit,eligibleAt:v.eligibleAt,done:v.done,signer:v.signer};}))).filter(o=>!o.done);
 const claims=await Promise.all(Array.from({length:Math.min(50,Number(BigInt(metrics.queueTail)-BigInt(metrics.queueHead)))},async(_,i)=>{const id=BigInt(metrics.queueHead)+BigInt(i),q=await c.exchange.claims(id,opts);return {id,user:q.user,amount:q.amount};}));
 const markets=await Promise.all(deployment.markets.map(async m=>{const q=await c.oracle.quotes(m.id,opts),risk=await c.exchange.markets(m.id,opts);return{...m,price:q.value,at:q[1],history:history[m.id],longNotional:await c.exchange.longNotional(m.id,opts),shortNotional:await c.exchange.shortNotional(m.id,opts),retiredPrice:await c.exchange.retiredPrice(m.id,opts),enabled:risk.enabled,bustBufferBps:Number(risk.bustBufferBps),maxLeverage:Number(risk.maxLeverage),delay:Number(risk.delay),executionWindow:Number(risk.executionWindow),minMargin:risk.minMargin,maxMargin:risk.maxMargin,sideCap:risk.sideCap,impact:risk.impact};}));
 const session=await c.exchange.sessions(wallets[6].address,wallets[9].address,opts),governanceOps=await Promise.all(operations.map(async op=>({...op,ready:await c.governance.isOperationReady(op.id,opts),done:await c.governance.isOperationDone(op.id,opts),pending:await c.governance.isOperationPending(op.id,opts)})));
 return {chainId:31337,rpcUrl:'http://127.0.0.1:9545',block:blockTag,timestamp:Number(BigInt(b.timestamp)),fork,contracts:deployment.contracts,actors:publicActors,accounts,metrics,markets,positions,orders,claims,journal:journal.slice(0,100),operations:governanceOps,heartbeat,testing:checkpoints.size>0,oraclePaused:await c.oracle.paused(opts),session:{owner:wallets[6].address,key:wallets[9].address,expiry:session.expiry,marginBudget:session.marginBudget},totalSupply:await c.token.totalSupply(opts),actor:index(actor)};
}
const mime={'.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.md':'text/plain'};
function respond(res,status,data,type='application/json'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'"});res.end(type==='application/json'?json(data):data);}
const server=http.createServer(async(req,res)=>{
 try{
 const host=req.headers.host;if(!['127.0.0.1:4173','localhost:4173'].includes(host))return respond(res,403,{error:'Loopback host required'});
 const origin=req.headers.origin;if(origin&&!['http://127.0.0.1:4173','http://localhost:4173'].includes(origin))return respond(res,403,{error:'Cross-origin request blocked'});
 const url=new URL(req.url,'http://'+host);
 if(req.method==='GET'&&url.pathname==='/api/state')return respond(res,200,await state(url.searchParams.get('actor')||6));
 if(req.method==='GET'&&url.pathname==='/api/abi')return respond(res,200,Object.fromEntries(Object.entries(names).map(([k,n])=>[k,build.contracts[n].abi])));
 if(req.method==='GET'&&url.pathname==='/api/wallets'){res.setHeader('Content-Disposition','attachment; filename="LOCAL-TEST-wallets.json"');return respond(res,200,wallets);}
 if(req.method==='GET'&&url.pathname.startsWith('/api/receipt/')){const hash=url.pathname.split('/').at(-1);if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Invalid hash');return respond(res,200,await provider.getTransactionReceipt(hash));}
 if(req.method==='POST'&&url.pathname==='/api/action'){
 if(req.headers['x-lab-request']!=='1')return respond(res,403,{error:'Local UI request header required'});
 let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>100000)throw Error('Request too large');}
 return respond(res,200,{ok:true,result:await serial(()=>action(JSON.parse(raw)))});
 }
 if(req.method!=='GET')return respond(res,405,{error:'Method not allowed'});
 const file=url.pathname==='/'||!path.extname(url.pathname)?'index.html':decodeURIComponent(url.pathname).slice(1);const full=path.resolve(dir,'public',file);if(!full.startsWith(path.join(dir,'public')+path.sep))return respond(res,403,{error:'Forbidden'});
 try{return respond(res,200,await readFile(full),mime[path.extname(full)]||'application/octet-stream');}catch{return respond(res,404,{error:'Not found'});}
 }catch(e){respond(res,400,{error:e.shortMessage||e.reason||e.message,detail:e.info?.error?.message||e.revert?.args?.[0]||null});}
});
server.listen(4173,'127.0.0.1',()=>console.log('Lab ready: http://127.0.0.1:4173 — local test funds only'));
setInterval(()=>{if(!heartbeat)return;serial(async()=>{for(const m of deployment.markets)await refresh(m.id);}).catch(e=>console.error('Heartbeat:',e.shortMessage||e.message));},10000).unref();
process.on('SIGTERM',async()=>{await chain;server.close();provider.destroy();process.exit(0);});
