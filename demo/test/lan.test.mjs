import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import net from 'node:net';
import {E,read,save} from '../scripts/shared.mjs';
import {walletClient} from '../public/wallet.js';
const ip=process.env.LAB_LAN_IP||Object.values(os.networkInterfaces()).flat().find(a=>a.family==='IPv4'&&!a.internal&&/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address))?.address;
assert(ip,'LAN IPv4 required');const base=process.env.LAB_TEST_BASE||`http://${ip}:4173`,hashes=[];
async function get(path='/api/state'){const r=await fetch(base+path,{signal:AbortSignal.timeout(10000)});const j=await r.json();assert(r.ok,JSON.stringify(j));return j;}
async function rpc(method,params=[]){const r=await fetch(base+'/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(10000)});return r.json();}
async function until(fn,ms=20000){const end=Date.now()+ms;while(Date.now()<end){const value=await fn();if(value)return value;await new Promise(r=>setTimeout(r,500));}throw Error('Timed out');}
const wallets=await read('wallets.local.json');
function client(actor){const signer=new E.Wallet(wallets[actor].privateKey),provider={on(){},async request({method,params=[]}){
 if(method==='eth_requestAccounts'||method==='eth_accounts')return [signer.address];if(method==='wallet_switchEthereumChain')return null;
 if(method==='eth_signTypedData_v4'){const data=JSON.parse(params[1]);const types={...data.types};delete types.EIP712Domain;return signer.signTypedData(data.domain,types,data.message);}
 if(method==='eth_sendTransaction'){
  const t={...params[0],chainId:31337,nonce:Number(BigInt((await rpc('eth_getTransactionCount',[signer.address,'pending'])).result)),gasLimit:params[0].gas,gasPrice:(await rpc('eth_gasPrice')).result,type:0};delete t.gas;delete t.from;
  const signed=await signer.signTransaction(t),r=await rpc('eth_sendRawTransaction',[signed]);if(r.error)throw Error(r.error.message);hashes.push(r.result);return r.result;
 }
 const r=await rpc(method,params);if(r.error)throw Error(r.error.message);return r.result;
}};return walletClient({provider,base});}
test('gateway serves shared state, blocks key export, admin writes and unsafe RPC',async()=>{
 const s=await get();assert.equal(s.shared.mode,'shared-lan');assert.equal(s.chainId,31337);assert.equal(s.fork.sourceChainId,4663);
 assert.equal((await fetch(base+'/api/wallets')).status,403);
 for(const path of ['/api/action','/api/showcase']){const r=await fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1'},body:JSON.stringify({action:'restore',command:'start',actor:0})});assert.equal(r.status,403);}
 for(const method of ['evm_snapshot','evm_revert','evm_increaseTime','anvil_reset','anvil_impersonateAccount','eth_sendTransaction','eth_sign','eth_accounts','personal_unlockAccount'])assert((await rpc(method,[])).error,method);
 assert.equal((await rpc('eth_chainId')).result,'0x7a69');
 const extension='chrome-extension://nkbihfbeogaeaoehlefnkodbefgpgknn';
 const preflight=await fetch(base+'/rpc',{method:'OPTIONS',headers:{Origin:extension,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'content-type'}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),extension);
 const walletRpc=await fetch(base+'/rpc',{method:'POST',headers:{Origin:extension,'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})});assert.equal((await walletRpc.json()).result,'0x7a69');
 assert.equal((await fetch(base+'/api/state',{headers:{Origin:'http://evil.example'}})).status,403);
 await new Promise(resolve=>{const socket=net.connect({host:ip,port:9545});socket.on('connect',()=>{socket.destroy();assert.fail('Unlocked Anvil must remain loopback-only');});socket.on('error',()=>resolve());socket.setTimeout(2000,()=>{socket.destroy();resolve();});});
});
test('same browser wallet client signs approve/deposit/withdraw through LAN and indexes external receipts',async()=>{
 const before=await get(),w=client(6);await w.connect();await w.action('deposit',{amount:'1'});await until(async()=>BigInt((await get()).accounts[6].available)===BigInt(before.accounts[6].available)+1000000n);
 await w.action('withdraw',{amount:'1'});await until(async()=>{const s=await get();return s.accounts[6].available===before.accounts[6].available&&hashes.every(h=>s.journal.some(j=>j.hash===h&&j.external));});
 const index=await get('/api/index');assert(hashes.every(h=>index.transactions.some(t=>t.hash===h&&t.status===1)));
 for(const h of hashes)assert.equal((await rpc('eth_getTransactionReceipt',[h])).result.status,'0x1');
});
test('real-time Binance publishes, delayed keeper fills signed open and close without rewind',async()=>{
 const before=await get(),w=client(7);await w.connect();await save('lan-control.local.json',{feed:true});
 try{
  await until(async()=>{const s=await get();return s.shared.quotes>=2&&s.shared.feed==='BINANCE SPOT · LIVE';},30000);
  const q=await get();assert(q.markets.every(m=>q.timestamp-Number(m.at)<10));assert(q.markets.every(m=>m.history.some(p=>p.hash)));
  await w.action('open',{market:1,isLong:false,amount:'5',leverage:2});
  const p=await until(async()=>{const s=await get();return s.positions.find(p=>p.user.toLowerCase()===wallets[7].address.toLowerCase()&&!before.positions.some(old=>old.id===p.id));},30000);
  assert.equal(p.leverage,2);await new Promise(r=>setTimeout(r,2200));await w.action('close',{id:p.id});
  await until(async()=>!(await get()).positions.some(v=>v.id===p.id),30000);
  const after=await get();assert(after.shared.fills>=2);assert(after.block>before.block);assert.equal(after.chainEpoch,before.chainEpoch);assert.equal(after.testing,false);assert.equal(after.metrics.cashInvariant,true);
  await save('lan-proof.local.json',{checkedAt:new Date().toISOString(),base,passed:true,position:p,hashes,shared:after.shared,block:after.block,fork:after.fork,restored:false});
 }finally{await save('lan-control.local.json',{feed:false});await until(async()=>(await get()).shared.feed==='OFF',10000);}
});
test('staker signs approval, stake and unstake on shared chain; stake custody remains backed',async()=>{
 const w=client(8);await w.connect();const before=await get();await w.action('unstake',{amount:'1'});await w.action('stake',{amount:'1'});
 await until(async()=>(await get()).accounts[8].staked===before.accounts[8].staked);
 const after=await get();assert.equal(after.accounts[8].part,before.accounts[8].part);assert.equal(after.metrics.cashInvariant,true);
});
test('assigned session wallet signs EIP-712 orders; owner revokes without exposing withdrawal authority',async()=>{
 const owner=client(6),session=client(9);await owner.connect();await session.connect();const before=await get();await owner.action('session',{amount:'10',key:wallets[9].address});await save('lan-control.local.json',{feed:true});
 try{
  await until(async()=>(await get()).shared.feed==='BINANCE SPOT · LIVE',30000);
  await session.action('open',{session:true,market:1,isLong:true,amount:'5',leverage:2});
  const p=await until(async()=>(await get()).positions.find(p=>p.user.toLowerCase()===wallets[6].address.toLowerCase()&&!before.positions.some(old=>old.id===p.id)),30000);
  await new Promise(r=>setTimeout(r,2200));await session.action('close',{session:true,id:p.id});await until(async()=>!(await get()).positions.some(v=>v.id===p.id),30000);
  await owner.action('revoke',{key:wallets[9].address});assert.equal((await get()).session.marginBudget,'0');
 }finally{
  await save('lan-control.local.json',{feed:false});
  // Restore the owner's prior authorization through a new signed on-chain operation.
  if(Number(before.session.expiry)>Date.now()/1000)await owner.action('contract',{contract:'exchange',fn:'setSession',args:[wallets[9].address,before.session.expiry,before.session.marginBudget]});
 }
});
test('role wallets schedule/index/cancel governance; trader cannot impersonate privileged signers',async()=>{
 const governor=client(0),trader=client(7);await governor.connect();await trader.connect();
 await assert.rejects(()=>trader.action('pause'));
 await assert.rejects(()=>trader.action('faucet',{amount:'1'}));
 const before=await get();await governor.action('governanceSchedule',{contract:'oracle',fn:'setPaused',args:[false]});
 const operation=await until(async()=>(await get()).operations.find(o=>!before.operations.some(old=>old.id===o.id)),20000);
 assert.equal(operation.fn,'setPaused');assert.equal(operation.pending,true);assert.equal(operation.ready,false);
 await assert.rejects(()=>governor.action('governanceExecute',{id:operation.id}));
 await governor.action('governanceCancel',{id:operation.id});await until(async()=>(await get()).operations.find(o=>o.id===operation.id)?.pending===false);
});
