import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { Interface, Wallet, Signature, AbiCoder, id } from 'ethers';
import { BBO, bboRuntime } from '../local/mock-bbo.mjs';
const root=path.resolve(import.meta.dirname,'..');
const addresses=JSON.parse(await readFile(path.join(root,'inspection/official-addresses.json'),'utf8'));
const endpoint=process.env.LOCAL_RPC_URL??'http://127.0.0.1:8545';
const url=new URL(endpoint);
if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('Mutating tests require a loopback endpoint');
async function rpc(method,params=[]){const r=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});const x=await r.json();if(x.error)throw Error(JSON.stringify(x.error));return x.result;}
assert.equal(await rpc('eth_chainId'),'0x7a69','Local-only chain ID 31337 required');
assert.match(await rpc('web3_clientVersion'),/anvil/i,'Anvil required');
const snapshot=await rpc('evm_snapshot');
const results=[];
async function test(name,fn){try{const evidence=await fn();results.push({name,pass:true,evidence});console.log('PASS',name);}catch(e){results.push({name,pass:false,error:e.message});console.log('FAIL',name,e.message);}}
const coder=AbiCoder.defaultAbiCoder();
const read=async(address,sig,args=[],types=['uint256'])=>{
 const iface=new Interface([`function ${sig}`]);
 const raw=await rpc('eth_call',[{to:address,data:iface.encodeFunctionData(sig.split('(')[0],args)},'latest']);
 return coder.decode(types,raw);
};
const impersonate=async a=>{await rpc('anvil_impersonateAccount',[a]);await rpc('anvil_setBalance',[a,'0x56bc75e2d63100000']);};
async function send(from,to,sig,args){const iface=new Interface([`function ${sig}`]);const hash=await rpc('eth_sendTransaction',[{from,to,data:iface.encodeFunctionData(sig.split('(')[0],args),gas:'0x1e8480'}]);await rpc('evm_mine');const receipt=await rpc('eth_getTransactionReceipt',[hash]);assert.ok(receipt,'Receipt missing after local mine');assert.equal(receipt.status,'0x1',`Transaction reverted: ${hash}`);return hash;}
const wallet=Wallet.createRandom(), user=wallet.address, amount=100n*10n**18n;
await impersonate(user);
try{
 await test('Archived PAPER runtime matches local fork',async()=>{
  const expected=(await readFile(path.join(root,'upstream/contracts/PaperToken/runtime.hex'),'utf8')).trim();
  assert.equal(await rpc('eth_getCode',[addresses.PaperToken,'latest']),expected);return {address:addresses.PaperToken};
 });
 await test('PAPER metadata reads from deployed proxy',async()=>{
  const [name]=await read(addresses.PaperToken,'name()',[],['string']);assert.equal(name,'Paper');
  const [decimals]=await read(addresses.PaperToken,'decimals()');assert.equal(decimals,18n);return {name,decimals:String(decimals)};
 });
 await test('Unauthorized PAPER mint reverts',async()=>{
  const iface=new Interface(['function mint(address,uint256)']);let rejected=false;
  try{await rpc('eth_call',[{from:user,to:addresses.PaperToken,data:iface.encodeFunctionData('mint',[user,amount])},'latest']);}catch{rejected=true;}
  assert.ok(rejected);return {rejected};
 });
 await test('Authorized minter can mint PAPER on local fork',async()=>{
  const [minter]=await read(addresses.PaperToken,'minter()',[],['address']);await impersonate(minter);
  const hash=await send(minter,addresses.PaperToken,'mint(address,uint256)',[user,amount]);
  const [balance]=await read(addresses.PaperToken,'balanceOf(address)',[user]);assert.equal(balance,amount);return {hash,minter,balance:String(balance)};
 });
 await test('Launch transfer restriction blocks ordinary wallet transfer',async()=>{
  const iface=new Interface(['function transfer(address,uint256)']);let rejected=false;
  try{await rpc('eth_call',[{from:user,to:addresses.PaperToken,data:iface.encodeFunctionData('transfer',[Wallet.createRandom().address,1n])},'latest']);}catch{rejected=true;}
  assert.ok(rejected,'Transfers may have been enabled since capture');return {rejected};
 });
 await test('User approves PAPER staking locally',async()=>({hash:await send(user,addresses.PaperToken,'approve(address,uint256)',[addresses.PaperStaking,amount])}));
 const types=JSON.parse(await readFile(path.join(root,'inspection/typed-data.json'),'utf8')).find(x=>x.value).value;
 const latest=await rpc('eth_getBlockByNumber',['latest',false]);
 const deadline=BigInt(latest.timestamp)+3600n;
 const domain={name:'PaperStaking',version:'1',chainId:31337,verifyingContract:addresses.PaperStaking};
 let executor;
 await test('Wallet-signed Stake intent executes through authorized executor',async()=>{
  [executor]=await read(addresses.PaperStaking,'authorizedExecutor()',[],['address']);await impersonate(executor);
  const nonce=BigInt('0x'+Wallet.createRandom().privateKey.slice(2));
  const message={user,amount,nonce,deadline};
  const signature=Signature.from(await wallet.signTypedData(domain,{Stake:types.Stake},message));
  const hash=await send(executor,addresses.PaperStaking,'stakeBySig(address,uint256,uint256,uint64,uint8,bytes32,bytes32)',[user,amount,nonce,deadline,signature.v,signature.r,signature.s]);
  const [balance]=await read(addresses.PaperStaking,'stakedBalance(address)',[user]);assert.equal(balance,amount);return {hash,stakedBalance:String(balance)};
 });
 await test('Wallet-signed Unstake intent returns PAPER',async()=>{
  const nonce=BigInt('0x'+Wallet.createRandom().privateKey.slice(2));
  const signature=Signature.from(await wallet.signTypedData(domain,{Unstake:types.Unstake},{user,amount,nonce,deadline}));
  const hash=await send(executor,addresses.PaperStaking,'unstakeBySig(address,uint256,uint256,uint64,uint8,bytes32,bytes32)',[user,amount,nonce,deadline,signature.v,signature.r,signature.s]);
  const [balance]=await read(addresses.PaperToken,'balanceOf(address)',[user]);assert.equal(balance,amount);return {hash,balance:String(balance)};
 });
 await test('Governance owner and timelock delay are readable',async()=>{
  const [owner]=await read(addresses.Exchange,'owner()',[],['address']);assert.equal(owner.toLowerCase(),addresses.Timelock.toLowerCase());
  const [delay]=await read(addresses.Timelock,'minDelay()');assert.equal(delay,604800n);return {owner,delaySeconds:String(delay)};
 });
 const priceCaptures=JSON.parse(await readFile(path.join(root,'inspection/hypercore-precompile-reads.json'),'utf8')).filter(x=>x.address===BBO);
 const prices=Object.fromEntries(priceCaptures.map(x=>[x.asset,[...coder.decode(['uint64','uint64'],x.raw)]]));
 await test('Explicit local BBO fixture reproduces archived BTC and ETH reads',async()=>{
  await rpc('anvil_setCode',[BBO,bboRuntime(prices)]);
  for(const p of priceCaptures)assert.equal(await rpc('eth_call',[{to:BBO,data:p.data},'latest']),p.raw);
  return {fixture:true,source:'inspection/hypercore-precompile-reads.json'};
 });
 const session=Wallet.createRandom();
 await test('Wallet registers scoped session key through authorized executor',async()=>{
  const expiry=deadline+86400n;
  const message={user,key:session.address,expiry,feeAddress:addresses.Multisig,nonce:12345n,deadline};
  const signature=Signature.from(await wallet.signTypedData({name:'String',version:'1',chainId:31337,verifyingContract:addresses.Exchange},{RegisterSessionKey:types.RegisterSessionKey},message));
  const hash=await send(executor,addresses.SessionKeyManager,'registerSessionKeyBySig(address,address,uint64,address,uint256,uint64,uint8,bytes32,bytes32)',[user,session.address,expiry,message.feeAddress,message.nonce,deadline,signature.v,signature.r,signature.s]);
  return {hash,key:session.address};
 });
 const margin=100n*10n**18n;
 await test('Local staking authority credits synthetic test collateral',async()=>{
  await impersonate(addresses.PaperStaking);
  const hash=await send(addresses.PaperStaking,addresses.Exchange,'creditStakingReward(address,uint256)',[user,margin*3n]);
  const [balance]=await read(addresses.Exchange,'balances(address)',[user]);assert.ok(balance>=margin*3n);
  return {hash,syntheticFixture:true,balance:String(balance),note:'Exercises accounting only; bypasses real HyperCore deposit and USDC backing'};
 });
 let positionId,openArgs;
 await test('Session-signed leveraged open executes against deployed Exchange bytecode',async()=>{
  [positionId]=await read(addresses.Exchange,'nextPositionId()');
  const message={user,instrumentId:0,isLong:true,size:margin,leverage:100,useDebt:false,nonce:12346n,deadline};
  const signature=Signature.from(await session.signTypedData({name:'String',version:'1',chainId:31337,verifyingContract:addresses.Exchange},{OpenPosition:types.OpenPosition},message));
  openArgs=[user,0,true,margin,100,false,message.nonce,deadline,signature.v,signature.r,signature.s];
  const hash=await send(executor,addresses.Exchange,'openPositionBySig(address,uint32,bool,uint128,uint32,bool,uint256,uint64,uint8,bytes32,bytes32)',openArgs);
  const [owner]=await read(addresses.Exchange,'positionOwner(uint256)',[positionId],['address']);assert.equal(owner.toLowerCase(),user.toLowerCase());return {hash,positionId:String(positionId),margin:String(margin),leverage:100};
 });
 await test('Replaying the signed open is rejected',async()=>{
  const iface=new Interface(['function openPositionBySig(address,uint32,bool,uint128,uint32,bool,uint256,uint64,uint8,bytes32,bytes32)']);let rejected=false;
  try{await rpc('eth_call',[{from:executor,to:addresses.Exchange,data:iface.encodeFunctionData('openPositionBySig',openArgs)},'latest']);}catch{rejected=true;}assert.ok(rejected);return {rejected};
 });
 await test('Session-signed profitable close settles and returns margin',async()=>{
  const higher={...prices,0:prices[0].map(x=>x*101n/100n)};await rpc('anvil_setCode',[BBO,bboRuntime(higher)]);
  const [before]=await read(addresses.Exchange,'balances(address)',[user]);
  const message={user,positionIds:[positionId],nonce:12347n,deadline};
  const signature=Signature.from(await session.signTypedData({name:'String',version:'1',chainId:31337,verifyingContract:addresses.Exchange},{Close:types.Close},message));
  const hash=await send(executor,addresses.Exchange,'closeBySig(address,uint256[],uint256,uint64,uint8,bytes32,bytes32)',[user,[positionId],message.nonce,deadline,signature.v,signature.r,signature.s]);
  const [after]=await read(addresses.Exchange,'balances(address)',[user]);assert.ok(after>before+margin);return {hash,marginReturned:String(margin),netProfit:String(after-before-margin),priceFixtureMove:'approximately +1%'};
 });
 await test('Hard liquidation forfeits isolated margin and mints loss-based PAPER',async()=>{
  await rpc('anvil_setCode',[BBO,bboRuntime(prices)]);
  const [idBefore]=await read(addresses.Exchange,'nextPositionId()');
  const message={user,instrumentId:0,isLong:true,size:margin,leverage:100,useDebt:false,nonce:12348n,deadline};
  const sig=Signature.from(await session.signTypedData({name:'String',version:'1',chainId:31337,verifyingContract:addresses.Exchange},{OpenPosition:types.OpenPosition},message));
  await send(executor,addresses.Exchange,'openPositionBySig(address,uint32,bool,uint128,uint32,bool,uint256,uint64,uint8,bytes32,bytes32)',[user,0,true,margin,100,false,message.nonce,deadline,sig.v,sig.r,sig.s]);
  const [before]=await read(addresses.PaperToken,'balanceOf(address)',[user]);
  await rpc('anvil_setCode',[BBO,bboRuntime({...prices,0:prices[0].map(x=>x*98n/100n)})]);
  const hash=await send(user,addresses.Exchange,'liquidate(uint256)',[idBefore]);
  const [after]=await read(addresses.PaperToken,'balanceOf(address)',[user]);assert.ok(after>before);
  return {hash,positionId:String(idBefore),isolatedMarginForfeited:String(margin),paperMinted:String(after-before),fixture:true};
 });
 await test('Wallet can directly revoke its session key',async()=>({hash:await send(user,addresses.SessionKeyManager,'revokeSessionKey(address)',[session.address])}));
}finally{
 const reverted=await rpc('evm_revert',[snapshot]);
 await mkdir(path.join(root,'local'),{recursive:true});
 await writeFile(path.join(root,'local/smoke-results.json'),JSON.stringify({endpoint,chainId:31337,ranAt:new Date().toISOString(),stateReverted:reverted,tests:results},null,2)+'\n');
}
if(results.some(x=>!x.pass))process.exitCode=1;
