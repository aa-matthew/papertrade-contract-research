import assert from 'node:assert/strict';
import {E,save} from './shared.mjs';
import {source,validateQuotes} from './binance-sim.mjs';

export function createShowcase({state,action,serial,previous}) {
 let status=previous?{...previous,running:false,feed:'OFF'}:{running:false,phase:'Ready',insight:'Choose the full product tour or a continuous trading desk.',events:[],completed:[],restored:true},task,stopRequested=false;
 const stopped=()=>{if(stopRequested)throw Error('SHOWCASE_STOP');};
 const call=async(actionName,actor=6,args={})=>{stopped();const result=await serial(()=>action({action:actionName,actor,...args}));return result;};
 const note=(text,detail={})=>{status.events.unshift({at:new Date().toISOString(),text,...detail});status.events=status.events.slice(0,100);};
 async function pause(ms){const end=Date.now()+ms;while(Date.now()<end){stopped();await new Promise(r=>setTimeout(r,Math.min(100,end-Date.now())));}}
 async function phase(name,insight,route,work,pace){stopped();status.phase=name;status.insight=insight;status.route=route;note(name);await work();status.completed.push(name);await pause(pace);}
 async function publish(market,price){const result=await call('price',2,{market,amount:price});status.quotes++;status.lastPriceAt=new Date().toISOString();return result;}
 async function open(actor,market,isLong,amount='25',leverage=10,session=false){const before=await state(),r=await call('open',actor,{market,isLong,amount,leverage,session});const after=await state(),owner=after.actors[session?6:actor].address;const p=after.positions.find(p=>p.user===owner&&!before.positions.some(old=>old.id===p.id));assert(p,'Filled position not found');note(`${after.actors[actor].name} ${isLong?'long':'short'} ${market===1?'BTC':'ETH'} #${p.id}`,{hash:r.hash});status.trades++;return p;}
 async function close(actor,p,session=false){const r=await call('close',actor,{id:p.id,session});assert(!(await state()).positions.some(v=>v.id===p.id));note('Settled position #'+p.id,{hash:r.hash});status.trades++;}
 async function run(options,initial){
  let checkpoint;const pace=options.paceMs??3000,started=Date.now(),base=Object.fromEntries(initial.markets.map(m=>[m.id,Number(E.formatEther(m.price))]));let tick=0;
  async function prices(){
   stopped();if(options.source==='binance'){
    const response=await fetch(source,{signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error('Binance HTTP '+response.status+'; no synthetic fallback');
    for(const q of validateQuotes(await response.json()))await publish(q.market,q.price);status.feed='BINANCE SPOT · LIVE';
   }else{
    for(const market of [1,2]){const factor=1+0.0015*Math.sin(tick*.6+market)+0.0004*Math.sin(tick*1.7);await publish(market,(base[market]*factor).toFixed(8));}status.feed='SCRIPTED SCENARIO · NOT LIVE';
   }tick++;
  }
  try{
   checkpoint=(await serial(()=>action({action:'snapshot',actor:6}))).id;await call('heartbeat',2,{flag:false});
   // Keep the chart legible for a presentation; restore retains the original observations.
   await serial(()=>action({action:'presentationHistory',actor:2}));
   await phase('01 · Fork & custody','Robinhood state is forked at a pinned block. Contracts, signatures and receipts execute locally on chain 31337. LABUSD has no real value.','contracts',async()=>{
    await prices();await call('deposit',6,{amount:'100'});await call('withdraw',6,{amount:'100'});note('ERC-20 approval → deposit → withdrawal confirmed');
   },pace);
   let long,short;
   await phase('02 · Automated trading desk','The trader commits intent. A later quote and keeper transaction fill the order. The bot never bypasses contract permissions.','trade',async()=>{
    long=await open(6,1,true);short=await open(7,2,false);
    const deskStart=Date.now();
    for(let i=0;options.kind==='market'?Date.now()-deskStart<options.duration*1000:i<8;i++){
     const frame=Date.now();await prices();status.cycles=i+1;
     if(i>0&&i%5===0){await close(6,long);await close(7,short);long=await open(6,1,true);short=await open(7,2,false);}
     await pause(Math.max(0,(options.kind==='market'?2000:pace===0?0:1000)-(Date.now()-frame)));
    }
    await close(6,long);await close(7,short);
   },pace);
   if(options.kind!=='market'){
    await phase('03 · Scoped session key','The session key can spend Alice’s cumulative margin budget, but cannot withdraw her funds. Revocation blocks pending execution.','portfolio',async()=>{
     await call('session',6,{amount:'100',hours:24});const p=await open(9,1,true,'10',5,true);await close(9,p,true);
     const pending=await call('open',9,{market:1,amount:'10',leverage:5,session:true,auto:false});await call('revoke',6);
     let rejected=false;try{await call('execute',3,{id:pending.orderId});}catch(e){if(stopRequested)throw e;rejected=true;}assert(rejected,'Revocation must block pending fill');await call('cancel',6,{id:pending.orderId});note('Revoked session fill correctly rejected');
    },pace);
    status.feed='SCRIPTED STRESS · NOT BINANCE';
    await phase('04 · Liquidation → PART','Controlled stress fixture: a 2% adverse move liquidates a 100× short. Realized loss mints participation; PART has no redemption promise.','operations',async()=>{
     const p=await open(7,2,false,'100',100);await publish(2,(Number(E.formatEther(p.entry))*1.02).toFixed(8));const r=await call('liquidate',4,{id:p.id});assert(r.events.some(e=>e.name==='ParticipationMinted'));note('Liquidation and PART mint confirmed',{hash:r.hash});
    },pace);
    await phase('05 · Stake → fees → claim','Rewards come from funded trading fees. Stake is restricted PART; claims pay collateral to the wallet. This does not imply a guaranteed APY.','staking',async()=>{
     await call('stake',7,{amount:'1000'});await call('fees',3);const before=await state();assert(BigInt(before.accounts[7].rewards)>0n);const r=await call('claim',7);assert(BigInt((await state()).accounts[7].wallet)>BigInt(before.accounts[7].wallet));await call('unstake',7,{amount:'1000'});await call('claim',8);note('Bob staked, earned, claimed and unstaked',{hash:r.hash});
    },pace);
    await phase('06 · Daily payout limit & FIFO','Controlled large move: net profit credits share 5m per UTC day. Excess remains debt in FIFO. The cap throttles payouts; it does not make the house solvent.','house',async()=>{
     await call('faucet',6,{amount:'1000000'});await call('deposit',6,{amount:'1000000'});const p=await open(6,1,true,'1000000',100);
     await publish(1,(Number(E.formatEther(p.entry))*1.1).toFixed(8));await close(6,p);const s=await state();assert.equal(s.metrics.dailyPayoutRemaining,'0');assert(BigInt(s.metrics.totalQueued)>0n);status.queueProof={queued:s.metrics.totalQueued,remaining:s.metrics.dailyPayoutRemaining};note('Daily budget exhausted; excess profit remains queued');
    },pace);
    await phase('07 · FIFO settlement after reset','The local clock advances to the next UTC budget. Treasury donation supplies actual cash; the keeper settles outstanding claims in order.','house',async()=>{
     await call('faucet',5,{amount:'2000000'});await call('seed',5,{amount:'2000000'});await call('advance',3,{seconds:86401});await call('harvest',3);assert.equal((await state()).metrics.totalQueued,'0');note('Next-day budget + funded house → FIFO paid');
    },pace);
    await phase('08 · Guardian & delayed governance','Guardian can pause immediately. The governor must schedule, wait and execute through the timelock; the local clock is explicitly accelerated.','operations',async()=>{
     await call('pause',1);const op=await call('governanceSchedule',0,{contract:'exchange',fn:'setOpensPaused',args:[false]});let rejected=false;try{await call('governanceExecute',0,{id:op.operationId});}catch(e){if(stopRequested)throw e;rejected=true;}assert(rejected,'Timelock must reject early execution');await call('advance',0,{seconds:86401});await call('governanceExecute',0,{id:op.operationId});assert.equal((await state()).metrics.opensPaused,false);note('Early execution rejected; delayed execution confirmed');
    },pace);
    await phase('09 · Terminal market retirement','Retirement disables new openings and freezes the settlement price. Existing positions retain an exit path. This is an emergency terminal action.','operations',async()=>{
     const p=await open(6,2,true,'10',5);await call('retire',1,{market:2});const frozen=(await state()).markets.find(m=>m.id===2).retiredPrice;assert(BigInt(frozen)>0n);await close(6,p);note('Market retired; frozen-price exit confirmed');
    },pace);
    await phase('10 · Surplus & funded distributions','Surplus is distributable only after positions, pending opens and queued claims are cleared. The treasury supplies test capital; the house retains its configured cap.','staking',async()=>{
     for(const order of (await state()).orders){const s=await state(),owner=s.actors.find(a=>a.address.toLowerCase()===order.user.toLowerCase());assert(owner,'Unknown order owner');await call('cancel',owner.index,{id:order.id});}
     for(const p of (await state()).positions){const s=await state(),owner=s.actors.find(a=>a.address.toLowerCase()===p.user.toLowerCase());assert(owner,'Unknown position owner');await close(owner.index,p);}
     await call('faucet',5,{amount:'10000000'});await call('seed',5,{amount:'10000000'});const r=await call('surplus',3);const s=await state();assert.equal(s.metrics.houseCash,s.metrics.houseCap);await call('claim',8);note('Surplus paid to staking; house retains its cap',{hash:r.hash});
    },pace);
   }
   const final=await state();assert.equal(final.metrics.cashInvariant,true);status.receipts=final.journal.filter(j=>!initial.journal.some(old=>old.hash===j.hash)).map(({hash,actor,contract,method,block,status:receiptStatus,events})=>({hash,actor,contract,method,block,status:receiptStatus,events}));
   assert(status.receipts.every(r=>r.status===1));status.outcome='completed';note('All showcase phases passed');
  }catch(e){status.outcome=stopRequested?'stopped':'failed';if(!stopRequested)status.error=e.message;note(stopRequested?'Stop requested':'Failed: '+e.message);}
  finally{
   status.phase='Restoring original state';
   try{
    if(checkpoint)await serial(()=>action({action:'restore',actor:6,id:checkpoint}));
    const restored=await state();const balances=s=>s.accounts.map(({native,...a})=>a);assert.deepEqual(balances(restored),balances(initial));assert.deepEqual(restored.positions,initial.positions);assert.equal(restored.heartbeat,initial.heartbeat);status.restored=true;
   }catch(e){status.error='Restore failed: '+e.message;status.outcome='failed';status.restored=false;}
   status.running=false;status.phase=status.restored?'Ready · original state restored':'Attention · restore failed';status.feed='OFF';status.stoppedAt=new Date().toISOString();status.elapsedSeconds=Math.round((Date.now()-started)/1000);await save('showcase.local.json',status);
  }
 }
 return {
  status:()=>structuredClone(status),
  async start(options={}){
   if(status.running)throw Error('Showcase already running');
   const kind=options.kind??'tour',sourceMode=options.source??'scenario',duration=Number(options.duration??120),paceMs=Number(options.paceMs??3000);
   if(!['tour','market'].includes(kind)||!['scenario','binance'].includes(sourceMode)||!Number.isInteger(duration)||duration<10||duration>1200||!Number.isInteger(paceMs)||paceMs<0||paceMs>10000)throw Error('Invalid showcase settings');
   // Reserve the run before the first await so two simultaneous starts cannot race.
   status={running:true,phase:'Preflight',insight:'Checking the existing deployment.',route:'showcase',feed:'STARTING',events:[],completed:[],quotes:0,trades:0,cycles:0,restored:false,startedAt:new Date().toISOString(),options:{kind,source:sourceMode,duration,paceMs}};stopRequested=false;task=undefined;
   try{const initial=await state();assert(!initial.testing,'A regression checkpoint is active');assert(!initial.oraclePaused&&!initial.metrics.opensPaused,'Preserve intentional pauses');assert(initial.markets.every(m=>m.retiredPrice==='0'),'Preserve retired markets');assert.equal(initial.metrics.totalQueued,'0','Start from an empty payout queue');assert(BigInt(initial.accounts[6].available)>=1000_000000n&&BigInt(initial.accounts[7].available)>=1000_000000n,'Alice/Bob need at least 1000 LABUSD available');
    task=run({kind,source:sourceMode,duration,paceMs},initial);return this.status();
   }catch(e){status.running=false;status.restored=true;status.phase='Preflight failed';status.feed='OFF';status.error=e.message;status.outcome='failed';throw e;}
  },
  async stop(){stopRequested=true;if(task)await task;return this.status();}
 };
}
