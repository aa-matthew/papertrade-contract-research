import test,{before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {readFile} from 'node:fs/promises';
import {JsonRpcProvider,ContractFactory,Wallet,AbiCoder,ZeroAddress,MaxUint256} from 'ethers';
import {deployProtocol,artifact,artifacts,send,preflight,root} from '../scripts/lib.mjs';
let node,provider,owner,user,other,p,config;
const U=10n**6n,W=10n**18n;
async function now(){return Number((await provider.send('eth_getBlockByNumber',['latest',false])).timestamp);}
async function tick(n=3){await provider.send('evm_increaseTime',[n]);await provider.send('evm_mine',[]);}
async function quote(value=80_000n*W){await send(p.oracle.set(value,await now()));}
async function invariant(){assert.equal(await p.exchange.cashInvariant(),true);assert.equal(await p.collateral.balanceOf(p.exchange.target),await p.exchange.accountedAssets());}
async function fund(s,amount=1_000n*U){const a=await s.getAddress();await send(p.collateral.mint(a,amount));await send(p.collateral.connect(s).approve(p.exchange.target,MaxUint256));await send(p.exchange.connect(s).deposit(amount));}
let nonce=1;
async function order(s,{positionId=0n,margin=100n*U,leverage=20,isLong=true,priceLimit,market=1}={}){
 const user=await s.getAddress();return {user,market,positionId,margin:positionId?0n:margin,leverage:positionId?0:leverage,isLong,priceLimit:priceLimit??1_000_000n*W,nonce:nonce++,deadline:await now()+20};
}
// Long opens and short closes are buys; the inverse directions are sells.
async function request(s,fields={}){const o=await order(s,fields);o.priceLimit=fields.priceLimit??((o.positionId===0n?o.isLong:!o.isLong)?1_000_000n*W:1n);const id=await p.exchange.nextOrder();await send(p.exchange.connect(s).request(o));return {id,o};}
async function execute(id,value=80_000n*W){await tick();await quote(value);await send(p.exchange.execute(id));}
async function open(s,fields={}){const id=await p.exchange.nextPosition();const q=await request(s,fields);await execute(q.id,fields.entry??80_000n*W);return id;}
async function close(s,id,value){await tick();const pos=await p.exchange.positions(id);const q=await request(s,{positionId:id,isLong:pos.isLong,market:pos.market});await execute(q.id,value);}
async function fixture(){p=await deployProtocol(owner,config,{local:true,retainOwner:true});await quote();await fund(user);await fund(other);}
before(async()=>{
 const port=await new Promise((resolve,reject)=>{const server=createServer();server.on('error',reject);server.listen(0,'127.0.0.1',()=>{const port=server.address().port;server.close(()=>resolve(port));});});
 node=spawn(process.env.ANVIL_BIN||'anvil',['--host','127.0.0.1','--port',String(port),'--chain-id','31337','--hardfork','cancun','--silent'],{stdio:'ignore'});
 node.on('error',()=>{});provider=new JsonRpcProvider(`http://127.0.0.1:${port}`,undefined,{cacheTimeout:-1});
 let ready=false;for(let i=0;i<60;i++){try{await provider.send('eth_chainId',[]);ready=true;break;}catch{await new Promise(r=>setTimeout(r,100));}}
 if(!ready)throw Error('Anvil unavailable; install Foundry or set ANVIL_BIN');
 owner=await provider.getSigner(0);user=await provider.getSigner(1);other=await provider.getSigner(2);
 config=JSON.parse(await readFile(root+'/config/local.json','utf8'));
});
after(()=>{provider?.destroy();node?.kill();});
test('deposit, wallet-only withdrawal and exact custody accounting',async()=>{
 await fixture();await invariant();const before=await p.collateral.balanceOf(await user.getAddress());await send(p.exchange.connect(user).withdraw(20n*U,await user.getAddress()));assert.equal(await p.collateral.balanceOf(await user.getAddress()),before+20n*U);await invariant();
 await assert.rejects(p.exchange.connect(other).withdraw(2_000n*U,await other.getAddress()));
});
test('commit delay, observation window, price limit, nonce replay and cancellation',async()=>{
 await fixture();const q=await request(user,{priceLimit:79_000n*W});assert.equal(await p.exchange.lockedMargin(),100n*U);
 await assert.rejects(p.exchange.execute(q.id));await tick();await assert.rejects(p.exchange.execute(q.id));await quote();await assert.rejects(p.exchange.execute(q.id));
 await assert.rejects(p.exchange.connect(user).request(q.o));await send(p.exchange.connect(user).cancel(q.id));assert.equal(await p.exchange.lockedMargin(),0n);await invariant();
 const stale=await request(user);await tick(22);await send(p.exchange.connect(other).cancel(stale.id));await invariant();
});
test('liquidation mints restricted PART, loss fees fund staking and wallet claims',async()=>{
 await fixture();const id=await open(user);await quote(75_000n*W);await send(p.exchange.liquidate(id));
 assert.equal(await p.token.balanceOf(await user.getAddress()),10_000n*W);assert.equal(await p.exchange.houseCash(),98n*U);
 await assert.rejects(p.token.connect(user).transfer(await other.getAddress(),W));await assert.rejects(p.token.mint(await other.getAddress(),W));
 await send(p.token.connect(user).approve(p.staking.target,MaxUint256));await send(p.staking.connect(user).stake(10_000n*W));await send(p.exchange.pushFees());assert.equal(await p.staking.pending(await user.getAddress()),U);
 const before=await p.collateral.balanceOf(await user.getAddress());await send(p.staking.connect(user).claim());assert.equal(await p.collateral.balanceOf(await user.getAddress()),before+U);
 await send(p.staking.connect(user).unstake(10_000n*W));await invariant();
});
test('profit queue stays unspendable, FIFO settlement, no new claim bypass',async()=>{
 await fixture();const first=await open(user);const second=await open(other);await close(user,first,88_000n*W);const q1=await p.exchange.totalQueued();assert(q1>0n);assert.equal(await p.exchange.balances(await user.getAddress()),1_000n*U);
 await close(other,second,88_000n*W);const q2=await p.exchange.totalQueued();assert(q2>q1);
 await send(p.collateral.mint(await owner.getAddress(),100n*U));await send(p.collateral.approve(p.exchange.target,MaxUint256));await send(p.exchange.seedLiquidity(100n*U));await send(p.exchange.harvest(1));
 assert.equal(await p.exchange.queued(await other.getAddress()),q2-q1);assert.equal(await p.exchange.queued(await user.getAddress()),q1-100n*U);await invariant();
 await send(p.collateral.mint(await owner.getAddress(),1_000n*U));await send(p.exchange.seedLiquidity(1_000n*U));await send(p.exchange.harvest(100));assert.equal(await p.exchange.totalQueued(),0n);await invariant();
});
test('cash-funded profitable close reserves fees; voluntary loss uses net emission basis',async()=>{
 await fixture();await send(p.collateral.mint(await owner.getAddress(),1_000n*U));await send(p.collateral.approve(p.exchange.target,MaxUint256));await send(p.exchange.seedLiquidity(1_000n*U));
 const winner=await open(user);await close(user,winner,88_000n*W);assert.equal(await p.exchange.totalQueued(),0n);assert((await p.exchange.stakerFees())>0n);await invariant();
 const loser=await open(other);await close(other,loser,79_000n*W);assert.equal(await p.token.balanceOf(await other.getAddress()),2_450n*W);await invariant();
});
test('session typed signatures, cumulative margin budget and revocation of pending execution',async()=>{
 await fixture();const key=Wallet.createRandom();await send(p.exchange.connect(user).setSession(key.address,await now()+3600,100n*U));
 const o=await order(user);o.priceLimit=1_000_000n*W;
 const types={Order:[['user','address'],['market','uint32'],['positionId','uint256'],['margin','uint128'],['leverage','uint32'],['isLong','bool'],['priceLimit','uint256'],['nonce','uint256'],['deadline','uint64']].map(([name,type])=>({name,type}))};
 const domain={name:'Robinhood Synthetic Protocol',version:'1',chainId:31337,verifyingContract:p.exchange.target};
 const signature=await key.signTypedData(domain,types,o);const id=await p.exchange.nextOrder();await send(p.exchange.requestBySig(o,key.address,signature));
 assert.equal((await p.exchange.sessions(o.user,key.address)).marginBudget,0n);
 const another={...o,nonce:nonce++};await assert.rejects(p.exchange.requestBySig(another,key.address,await key.signTypedData(domain,types,another)));
 await send(p.exchange.connect(user).revokeSession(key.address));await tick();await quote();await assert.rejects(p.exchange.execute(id));await send(p.exchange.connect(user).cancel(id));await invariant();
});
test('exposure cap, pause and retirement preserve exits',async()=>{
 await fixture();const risk={...config.markets[0].risk,sideCap:String(2_000n*U)};await send(p.exchange.configureMarket(1,risk));const id=await open(user);const extra=await request(other);await tick();await quote();await assert.rejects(p.exchange.execute(extra.id));await send(p.exchange.connect(other).cancel(extra.id));
 await send(p.exchange.setOpensPaused(true));await assert.rejects(request(other));await quote(81_000n*W);await send(p.exchange.retireMarket(1));await tick(40);await close(user,id,82_000n*W);assert.equal(await p.exchange.openCount(),0n);await invariant();
});
test('verified oracle normalizes decimals; rejects proof/feed/time/spread; sequencer grace and cached expiry',async()=>{
 const b=await artifacts();async function dep(n,args=[]){const a=artifact(b,n),c=await new ContractFactory(a.abi,a.evm.bytecode.object,owner).deploy(...args);await c.waitForDeployment();return c;}
 const v=await dep('MockVerifier'),seq=await dep('MockSequencer'),o=await dep('StreamOracle',[await owner.getAddress(),await owner.getAddress(),v.target,seq.target,60]);
 const feed='0x0003'+'11'.repeat(30);await send(o.configure(1,{id:feed,maxAge:10,maxSpreadBps:100,decimals:8,minPrice:1n*W,maxPrice:1_000_000n*W}));await send(o.setPaused(false));
 const coder=AbiCoder.defaultAbiCoder(),schema='tuple(bytes32,uint32,uint32,uint192,uint192,uint32,int192,int192,int192)';
 async function report(overrides={}){const t=await now(),r={feed,from:t,at:t,expires:t+5,price:80_000n*10n**8n,bid:79_990n*10n**8n,ask:80_010n*10n**8n,...overrides};return coder.encode([schema],[[r.feed,r.from,r.at,0,0,r.expires,r.price,r.bid,r.ask]]);}
 await send(o.update(1,await report(),'0x'));assert.equal((await o.price(1))[0],80_000n*W);
 await send(v.setReject(true));await assert.rejects(o.update(1,await report(),'0x'));await send(v.setReject(false));
 for(const overrides of [{feed:'0x0003'+'22'.repeat(30)},{at:await now()+100},{at:await now()-50,from:await now()-60},{bid:70_000n*10n**8n}])await assert.rejects(o.update(1,await report(overrides),'0x'));
 await send(seq.set(1,await now()));await assert.rejects(o.price(1));await send(seq.set(0,await now()));await assert.rejects(o.price(1));await tick(61);await send(o.update(1,await report(),'0x'));await tick(6);await assert.rejects(o.price(1));
});
test('timelock enforces delay and only scheduled owner operations',async()=>{
 await fixture();const b=await artifacts(),a=artifact(b,'ProtocolTimelock');const t=await new ContractFactory(a.abi,a.evm.bytecode.object,owner).deploy(86400,await owner.getAddress());await t.waitForDeployment();await send(p.exchange.transferOwnership(t.target));
 await assert.rejects(p.exchange.setHouseCap(2_000n*U));await assert.rejects(t.updateDelay(0));const data=p.exchange.interface.encodeFunctionData('setHouseCap',[2_000n*U]),zero='0x'+'00'.repeat(32),salt='0x'+'01'.repeat(32);
 await send(t.schedule(p.exchange.target,0,data,zero,salt,86400));await assert.rejects(t.execute(p.exchange.target,0,data,zero,salt));await tick(86401);await send(t.execute(p.exchange.target,0,data,zero,salt,{gasLimit:1_000_000}));assert.equal(await p.exchange.houseCap(),2_000n*U);
 const lower=t.interface.encodeFunctionData('updateDelay',[0]);await send(t.schedule(t.target,0,lower,zero,salt,86400));await tick(86401);await assert.rejects(t.execute(t.target,0,lower,zero,salt));
});
test('remote templates fail closed before any deployment',async()=>{const c=JSON.parse(await readFile(root+'/config/robinhood-testnet.json','utf8'));await assert.rejects(preflight(c),/verified nonzero collateral/);});
test('integrated emission curve crosses threshold, decays and keeps integer floor order',async()=>{
 const b=await artifacts(),a=artifact(b,'EconomicsHarness'),h=await new ContractFactory(a.abi,a.evm.bytecode.object,owner).deploy();await h.waitForDeployment();
 const threshold=2_000_000n*W,scale=120_000_000n*W,flatRate=100n*W;
 function model(lp,progress,basis){const flat=lp<threshold?(basis<threshold-lp?basis:threshold-lp):0n,tail=basis-flat,q0=scale*W/(scale+progress),q1=scale*W/(scale+progress+tail);return [flat*flatRate/W+(((flatRate*q0/W)*q1/W)*tail/W),tail];}
 for(const [lp,progress,basis] of [[0n,0n,100n*W],[threshold-10n*W,0n,100n*W],[threshold,0n,100n*W],[threshold,scale,100n*W],[threshold,scale*100n,1n],[-100n*W,scale,50n*W]]){
   assert.deepEqual(Array.from(await h.mintQuote(lp,progress,basis)),model(lp,progress,basis));
 }
 assert((await h.mintQuote(threshold,scale,100n*W))[0]<(await h.mintQuote(threshold,0,100n*W))[0]);
});
test('global $5m UTC daily profit cap spans closes and FIFO harvest without locking principal',async()=>{
 await fixture();
 // Start well inside a new UTC day so ordinary order timing cannot cross a boundary.
 await provider.send('evm_setNextBlockTimestamp',[(Math.floor(await now()/86400)+1)*86400+100]);await provider.send('evm_mine',[]);
 const limit=5_000_000n*U,day=BigInt(Math.floor(await now()/86400));
 assert.equal(await p.exchange.DAILY_PAYOUT_LIMIT(),limit);
 const risk={...config.markets[0].risk,maxLeverage:100,maxMargin:String(1_000_000n*U),sideCap:String(500_000_000n*U),impact:{base:'0',rate:String(10n**26n),position:String(10n**26n),referenceUsd:'0'}};
 await send(p.exchange.configureMarket(1,risk));await send(p.exchange.configureMarket(2,risk));await fund(user,500_000n*U);await fund(other,1_000_000n*U);
 await send(p.collateral.mint(await owner.getAddress(),20_000_000n*U));await send(p.collateral.approve(p.exchange.target,MaxUint256));await send(p.exchange.seedLiquidity(20_000_000n*U));
 const first=await open(user,{margin:400_000n*U,leverage:100}),second=await open(other,{margin:1_000_000n*U,leverage:100}),third=await open(user,{market:2,margin:100_000n*U,leverage:100});
 await close(user,first,88_000n*W);const paidFirst=await p.exchange.profitPaidByDay(day);assert(paidFirst>0n&&paidFirst<limit);const feesBefore=await p.exchange.stakerFees();
 await close(other,second,88_000n*W);assert.equal(await p.exchange.profitPaidByDay(day),limit);assert.equal(await p.exchange.dailyPayoutRemaining(),0n);assert.equal(await p.exchange.stakerFees(),feesBefore);
 const headBefore=await p.exchange.claims(1);assert.equal(headBefore.user,await other.getAddress());assert(headBefore.amount>limit);
 await close(user,third,88_000n*W);const newer=await p.exchange.queued(await user.getAddress());assert(newer>0n);assert.equal(await p.exchange.profitPaidByDay(day),limit);await invariant();
 const queuedBefore=await p.exchange.totalQueued(),houseBefore=await p.exchange.houseCash();await send(p.exchange.harvest(100));assert.equal(await p.exchange.totalQueued(),queuedBefore);assert.equal(await p.exchange.houseCash(),houseBefore);
 // Principal and already-credited profits remain withdrawable after the budget is exhausted.
 const balance=await p.exchange.balances(await user.getAddress());await send(p.exchange.connect(user).withdraw(balance,await user.getAddress()));assert.equal(await p.exchange.dailyPayoutRemaining(),0n);await invariant();
 const midnight=Number(day+1n)*86400;await provider.send('evm_setNextBlockTimestamp',[midnight-1]);await provider.send('evm_mine',[]);assert.equal(await p.exchange.dailyPayoutRemaining(),0n);
 await provider.send('evm_setNextBlockTimestamp',[midnight]);await provider.send('evm_mine',[]);assert.equal(await p.exchange.dailyPayoutRemaining(),limit);
 await send(p.exchange.harvest(100));assert.equal(await p.exchange.profitPaidByDay(day+1n),limit);assert.equal(await p.exchange.totalQueued(),queuedBefore-limit);assert.equal(await p.exchange.queued(await user.getAddress()),newer);assert.equal(await p.exchange.queueHead(),1n);await invariant();
 await provider.send('evm_setNextBlockTimestamp',[midnight+86400]);await provider.send('evm_mine',[]);await send(p.exchange.harvest(100));assert.equal(await p.exchange.totalQueued(),0n);assert.equal(await p.exchange.queueHead(),await p.exchange.queueTail());assert((await p.exchange.profitPaidByDay(day+2n))<=limit);assert.equal(await p.exchange.profitPaidByDay(day),limit);await invariant();
});
