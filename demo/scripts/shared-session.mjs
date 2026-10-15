// Shared LAN execution. This module never snapshots, rewinds time or signs as a trader.
import {randomBytes} from 'node:crypto';
import {source,validateQuotes} from './binance-sim.mjs';
export function sharedSession({E,provider,c,wallets,tx,setPrice,serial,read,save,getOperations}) {
 const status={mode:'shared-lan',persistent:true,url:'http://'+process.env.LAB_LAN_HOST,feed:'OFF',keeper:false,quotes:0,fills:0,error:null,lastQuoteAt:null};
 const allowed=new Set(['web3_clientVersion','net_version','net_listening','eth_chainId','eth_blockNumber','eth_getBlockByNumber','eth_getBlockByHash','eth_getBalance','eth_getCode','eth_getStorageAt','eth_call','eth_estimateGas','eth_gasPrice','eth_maxPriorityFeePerGas','eth_feeHistory','eth_getTransactionCount','eth_getTransactionReceipt','eth_getTransactionByHash','eth_getLogs','eth_sendRawTransaction']);
 const addresses=new Set(Object.values(c).map(v=>v.target.toLowerCase()));
 async function rpcOne(p){
  const id=p?.id??null;
  try{
   if(!p||p.jsonrpc!=='2.0'||!allowed.has(p.method)||!Array.isArray(p.params??[]))throw Error('RPC method blocked; use a signed wallet transaction');
   if(p.method==='eth_getLogs'){const f=p.params[0];if(!f||!f.address)throw Error('Contract address required');const a=Array.isArray(f.address)?f.address:[f.address];if(!a.every(x=>addresses.has(String(x).toLowerCase())))throw Error('Only lab contract logs');const head=await provider.getBlockNumber();const start=f.fromBlock==='latest'?head:Number(BigInt(f.fromBlock??'0x0'));const end=f.toBlock==='latest'||!f.toBlock?head:Number(BigInt(f.toBlock));if(end-start>2000||end<start)throw Error('Maximum 2000 blocks per log query');}
   if(p.method==='eth_sendRawTransaction'){
    const t=E.Transaction.from(p.params[0]);if(!t.signature||t.chainId!==31337n||!t.to||!addresses.has(t.to.toLowerCase())||t.value!==0n||t.gasLimit>5000000n||t.authorizationList?.length)throw Error('Only signed chain 31337 lab contract calls, zero native value, <=5m gas');
   }
   const result=await provider.send(p.method,p.params??[]);return {jsonrpc:'2.0',id,result};
  }catch(e){return {jsonrpc:'2.0',id,error:{code:-32000,message:e.shortMessage||e.message}};}
 }
 async function rpc(p){if(Array.isArray(p)){if(!p.length||p.length>20)return {jsonrpc:'2.0',id:null,error:{code:-32600,message:'Batch size 1–20'}};return Promise.all(p.map(rpcOne));}return rpcOne(p);}
 async function prepare(a){
  const user=E.getAddress(a.from),actor=wallets.findIndex(w=>w.address.toLowerCase()===user.toLowerCase());if(actor<0)throw Error('Connect one of the ten supplied test wallets');
  const transactions=[];const add=(key,fn,args=[])=>transactions.push({from:user,to:c[key].target,data:c[key].interface.encodeFunctionData(fn,args),value:'0x0',chainId:'0x7a69'});
  const units=(s,d=6)=>{if(!/^\d+(\.\d+)?$/.test(String(s)))throw Error('Positive decimal amount required');return E.parseUnits(String(s),d);};
  const amount=()=>units(a.amount??'0'),id=a.id??'0';let result,typedOrder;
  const owner=a.session?(actor===9?wallets[6].address:(()=>{throw Error('Use the assigned session wallet 09');})()):user;
  const request=async(positionId=0n)=>{
   let market=Number(a.market||1),isLong=a.isLong!==false,margin=units(a.amount||'100'),leverage=Number(a.leverage||20);
   if(positionId){const p=await c.exchange.positions(positionId);if(p.user.toLowerCase()!==owner.toLowerCase())throw Error('Position belongs to another wallet');market=Number(p.market);isLong=p.isLong;margin=0n;leverage=0;}
   const b=await provider.send('eth_getBlockByNumber',['latest',false]),risk=await c.exchange.markets(market),q=await c.oracle.quotes(market),retired=await c.exchange.retiredPrice(market),price=retired||q.value,buy=positionId?!isLong:isLong;
   const order={user:owner,market,positionId,margin,leverage,isLong,priceLimit:a.priceLimit?units(a.priceLimit,18):buy?price*105n/100n:price*95n/100n,nonce:BigInt('0x'+randomBytes(16).toString('hex')),deadline:Number(BigInt(b.timestamp))+Number(risk.delay)+Number(risk.executionWindow)-2};
   if(a.session){typedOrder={domain:{name:'Robinhood Synthetic Protocol',version:'1',chainId:31337,verifyingContract:c.exchange.target},types:{EIP712Domain:[{name:'name',type:'string'},{name:'version',type:'string'},{name:'chainId',type:'uint256'},{name:'verifyingContract',type:'address'}],Order:[['user','address'],['market','uint32'],['positionId','uint256'],['margin','uint128'],['leverage','uint32'],['isLong','bool'],['priceLimit','uint256'],['nonce','uint256'],['deadline','uint64']].map(([name,type])=>({name,type}))},primaryType:'Order',message:order};}else add('exchange','request',[order]);
  };
  switch(a.action){
   case 'signedRequest':{if(actor!==9||E.getAddress(a.order.user)!==E.getAddress(wallets[6].address))throw Error('Invalid assigned session');add('exchange','requestBySig',[a.order,user,a.signature]);break;}
   case 'deposit':add('collateral','approve',[c.exchange.target,amount()]);add('exchange','deposit',[amount()]);break;
   case 'withdraw':add('exchange','withdraw',[amount(),a.recipient||user]);break;
   case 'seed':add('collateral','approve',[c.exchange.target,amount()]);add('exchange','seedLiquidity',[amount()]);break;
   case 'stake':add('token','approve',[c.staking.target,units(a.amount,18)]);add('staking','stake',[units(a.amount,18)]);break;
   case 'unstake':add('staking','unstake',[units(a.amount,18)]);break;
   case 'claim':add('staking','claim');break;
   case 'open':await request();break;
   case 'close':await request(BigInt(id));break;
   case 'closeAll':{if(a.session)throw Error('Close session positions individually');const n=await c.exchange.nextPosition();for(let i=1n;i<n;i++){if((await c.exchange.positions(i)).user.toLowerCase()===owner.toLowerCase())await request(i);}break;}
   case 'cancel':case 'execute':case 'liquidate':add('exchange',a.action,[id]);break;
   case 'harvest':add('exchange','harvest',[Number(a.entries||100)]);break;
   case 'fees':add('exchange','pushFees');break;
   case 'surplus':add('exchange','sweepSurplus');break;
   case 'session':{const b=await provider.send('eth_getBlockByNumber',['latest',false]);add('exchange','setSession',[a.key||wallets[9].address,Number(BigInt(b.timestamp))+Number(a.hours||24)*3600,amount()]);break;}
   case 'revoke':add('exchange','revokeSession',[a.key||wallets[9].address]);break;
   case 'pause':add('exchange','setOpensPaused',[a.flag!==false]);break;
   case 'oraclePause':add('oracle','setPaused',[a.flag!==false]);break;
   case 'retire':add('exchange','retireMarket',[Number(a.market||1)]);break;
   case 'price':add('oracle','publish',[Number(a.market||1),units(a.amount,18)]);break;
   case 'faucet':add('collateral','mint',[a.recipient||user,amount()]);break;
   case 'governanceSchedule':{const key=a.contract||'exchange',target=c[key]?.target;if(!target)throw Error('Unknown contract');const data=c[key].interface.encodeFunctionData(a.fn,a.args||[]),salt=E.hexlify(randomBytes(32));add('governance','schedule',[target,0,data,E.ZeroHash,salt,await c.governance.getMinDelay()]);break;}
   case 'governanceCancel':add('governance','cancel',[id]);break;
   case 'governanceExecute':{const op=getOperations().find(o=>o.id===a.id);if(!op)throw Error('Operation not indexed yet; wait a moment or use the contract console');add('governance','execute',[op.target,0,op.data,op.pre,op.salt]);break;}
   case 'contract':{if(!c[a.contract])throw Error('Unknown contract');const f=c[a.contract].interface.getFunction(a.fn);if(['view','pure'].includes(f.stateMutability))result=await c[a.contract][a.fn](...(a.args||[]));else add(a.contract,a.fn,a.args||[]);break;}
   default:throw Error('This local rehearsal action is disabled in the persistent shared session');
  }
  return {transactions,result,typedOrder,actor,keeper:status.keeper};
 }
 let running=false,stopped=false,nextOrder=1n;const activeOrders=new Set();
 async function tick(){
  if(running||stopped)return;running=true;
  try{
   let control;try{control=await read('lan-control.local.json');}catch{control={feed:false};}
   status.keeper=!!control.feed;
   if(!control.feed){status.feed='OFF';return;}
   const r=await fetch(source,{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('Binance HTTP '+r.status+'; no synthetic fallback');const quotes=validateQuotes(await r.json());
   for(const q of quotes){await serial(()=>setPrice(2,q.market,q.price));status.quotes++;}
   status.lastQuoteAt=new Date().toISOString();status.feed='BINANCE SPOT · LIVE';status.error=null;
   const n=await c.exchange.nextOrder();for(;nextOrder<n;nextOrder++)activeOrders.add(nextOrder);
   const pending=await Promise.all([...activeOrders].map(async id=>[id,await c.exchange.pendingOrders(id)]));
   for(const [id,p]of pending){
    if(stopped)break;
    if(p.done||p.order.user===E.ZeroAddress){activeOrders.delete(id);continue;}
    const b=await provider.send('eth_getBlockByNumber',['latest',false]),now=Number(BigInt(b.timestamp));
    if(Number(p.order.deadline)<now){try{await serial(()=>tx(3,'exchange','cancel',[id]));activeOrders.delete(id);}catch(e){status.lastKeeperError=e.shortMessage||e.message;}continue;}
    if(Number(p.eligibleAt)>now)continue;
    const q=await c.oracle.quotes(p.order.market);if((await c.exchange.retiredPrice(p.order.market))===0n&&q[1]<p.eligibleAt)continue;
    try{await serial(()=>tx(3,'exchange','execute',[id]));status.fills++;status.lastKeeperError=null;activeOrders.delete(id);}catch(e){status.lastKeeperError=e.shortMessage||e.message;}
   }
  }catch(e){status.feed='ERROR · NO FALLBACK';status.error=e.shortMessage||e.message;}finally{running=false;}
 }
 const timer=setInterval(tick,2000);timer.unref();tick();
 return {status:()=>({...status}),prepare,rpc,stop:async()=>{stopped=true;clearInterval(timer);while(running)await new Promise(r=>setTimeout(r,50));}};
}
