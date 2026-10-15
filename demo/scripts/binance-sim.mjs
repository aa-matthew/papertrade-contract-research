// Bounded, checkpointed live-price experiment. No exchange API keys or remote writes.
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {E,save} from './shared.mjs';
const base='http://127.0.0.1:4173';
export const source='https://data-api.binance.vision/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22%5D';
export function validateQuotes(rows,now=Date.now()){
 if(!Array.isArray(rows)||rows.length!==2)throw Error('Expected both Binance symbols');
 return [['BTCUSDT',1],['ETHUSDT',2]].map(([symbol,market])=>{
  const matches=rows.filter(r=>r.symbol===symbol);if(matches.length!==1)throw Error('Missing/duplicate symbol '+symbol);
  const q=matches[0];if(!/^\d+(\.\d{1,8})?$/.test(q.lastPrice)||!(Number(q.lastPrice)>0))throw Error('Invalid price '+symbol);
  if(!Number.isSafeInteger(q.closeTime)||now-q.closeTime>10000||q.closeTime-now>2000)throw Error('Stale/future Binance observation '+symbol);
  return {symbol,market,price:q.lastPrice,sourceTime:q.closeTime,receivedAt:now};
 });
}
async function action(action,actor=6,args={}){
 const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1'},body:JSON.stringify({action,actor,...args}),signal:AbortSignal.timeout(20000)}),j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j.result;
}
async function state(){const r=await fetch(base+'/api/state',{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error(await r.text());return r.json();}
export async function run(seconds=8){
 if(!Number.isInteger(seconds)||seconds<5||seconds>60)throw Error('Duration must be 5–60 seconds');
 const initial=await state();assert.equal(initial.chainId,31337);assert.equal(initial.testing,false,'Another checkpoint is active');
 assert.equal(initial.oraclePaused,false,'Preserve intentional oracle pause');assert.equal(initial.metrics.opensPaused,false,'Preserve intentional trading pause');
 assert(initial.markets.every(m=>m.retiredPrice==='0'),'Preserve retired markets');
 const report={startedAt:new Date().toISOString(),source,priceKind:'Binance spot last trade, USDT treated as LABUSD for this experiment',requestedSeconds:seconds,running:true,observations:[],trades:[],staking:[],reverted:false,passed:false};
 const checkpoint=(await action('snapshot')).id;let stopping=false;
 const stop=()=>{stopping=true;};process.once('SIGINT',stop);process.once('SIGTERM',stop);
 try{
  await action('heartbeat',2,{flag:false});
  const start=Date.now();let opened=false;
  while(!stopping&&(Date.now()-start<seconds*1000||!opened)){
   const tickStart=Date.now();const r=await fetch(source,{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('Binance HTTP '+r.status);
   const quotes=validateQuotes(await r.json());
   for(const q of quotes){const receipt=await action('price',2,{market:q.market,amount:q.price});report.observations.push({...q,hash:receipt.hash});}
   const s=await state();for(const q of quotes)assert.equal(BigInt(s.markets.find(m=>m.id===q.market).price),E.parseUnits(q.price,18));
   if(!opened){
    for(const [actor,market,isLong]of [[6,1,true],[7,2,false]]){
     const before=await state(),result=await action('open',actor,{market,isLong,amount:'25',leverage:10}),after=await state();
     const position=after.positions.find(p=>p.user===after.actors[actor].address&&!before.positions.some(old=>old.id===p.id));assert(position,'New filled position missing');
     assert.equal(position.entry,after.markets.find(m=>m.id===market).price);
     report.trades.push({actor,market,isLong,positionId:position.id,entry:position.entry,openOrder:result.orderId});
    }
    opened=true;
   }
   console.log('Binance tick',report.observations.length/2,quotes.map(q=>q.symbol+'='+q.price).join(' '));
   const remaining=Math.min(1000-(Date.now()-tickStart),seconds*1000-(Date.now()-start));if(remaining>0)await new Promise(resolve=>setTimeout(resolve,remaining));
  }
  if(stopping)throw Error('Stopped by signal');
  // Close at a fresh real observation, with the ordinary delayed keeper flow.
  const response=await fetch(source,{signal:AbortSignal.timeout(4000)});if(!response.ok)throw Error('Binance HTTP '+response.status);
  for(const q of validateQuotes(await response.json())){const receipt=await action('price',2,{market:q.market,amount:q.price});report.observations.push({...q,hash:receipt.hash});}
  for(const trade of report.trades){
   const result=await action('close',trade.actor,{id:trade.positionId}),s=await state();assert(!s.positions.some(p=>p.id===trade.positionId));
   const closed=s.journal.find(j=>j.events.some(e=>e.name==='Closed'&&String(e.args[0])===String(trade.positionId)));assert.equal(closed.status,1);trade.closeOrder=result.orderId;trade.closeReceipt=closed;trade.exit=s.markets.find(m=>m.id===trade.market).price;
  }
  const before=await state(),reward=BigInt(before.accounts[8].rewards);assert(reward>0n);
  report.staking.push(await action('claim',8));assert.equal(BigInt((await state()).accounts[8].wallet),BigInt(before.accounts[8].wallet)+reward);
  report.staking.push(await action('unstake',8,{amount:'100'}));report.staking.push(await action('stake',8,{amount:'100'}));assert.equal((await state()).accounts[8].staked,before.accounts[8].staked);
  assert.equal((await state()).metrics.cashInvariant,true);assert(report.observations.length>=6,'Not enough continuous observations');
  report.passed=true;
 }catch(error){report.error=error.message;throw error;}
 finally{
  try{await action('restore',6,{id:checkpoint});report.reverted=true;const restored=await state();assert.deepEqual(restored.positions,initial.positions);const balances=accounts=>accounts.map(({native,...rest})=>rest);assert.deepEqual(balances(restored.accounts),balances(initial.accounts));assert.equal(restored.heartbeat,initial.heartbeat);report.restored=true;}catch(error){report.passed=false;report.error=error.message;throw error;}
  finally{report.running=false;report.stoppedAt=new Date().toISOString();report.wallSeconds=(Date.parse(report.stoppedAt)-Date.parse(report.startedAt))/1000;process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);await save('binance-simulation.local.json',report);console.log('Binance feed OFF; report: demo/.runtime/binance-simulation.local.json');}
 }
 return report;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){run(Number(process.argv[2]||8)).then(r=>console.log('PASS:',r.observations.length,'quotes,',r.trades.length,'round trips; original state restored')).catch(e=>{console.error(e.message);process.exitCode=1;});}
