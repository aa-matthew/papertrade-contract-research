import {E,read,save,connected,roles,runtime,json} from './shared.mjs';
import {writeFile} from 'node:fs/promises';
const p=await connected(),build=await read('compiled.local.json'),wallets=[];
for(let i=0;i<10;i++){const w=E.HDNodeWallet.fromPhrase('test test test test test test test test test test test junk',undefined,`m/44'/60'/0'/0/${i}`);wallets.push({index:i,name:roles[i][0],role:roles[i][1],address:w.address,privateKey:w.privateKey,network:'LOCAL TEST ONLY - never fund on public chains'});}
// Public dev addresses already carry EIP-7702 delegation on the source chain.
// Make only these ten local fixture accounts plain EOAs; never mutate upstream.
const accountOverrides=[];
for(const w of wallets){const code=await p.getCode(w.address);if(code!=='0x'){accountOverrides.push({address:w.address,sourceCodeHash:E.keccak256(code),localCode:'0x'});await p.send('anvil_setCode',[w.address,'0x']);}}
const signers=await Promise.all(wallets.map(w=>p.getSigner(w.address))),cs={},receipts=[];
async function send(tx){const t=await tx,r=await t.wait();receipts.push({hash:r.hash,block:r.blockNumber,gasUsed:r.gasUsed.toString()});return r;}
async function deploy(name,args=[]){const a=build.contracts[name],c=await new E.ContractFactory(a.abi,a.evm.bytecode.object,signers[0]).deploy(...args);await c.waitForDeployment();receipts.push({contract:name,address:c.target,hash:c.deploymentTransaction().hash});return c;}
cs.collateral=await deploy('LabCollateral',[wallets[5].address]);cs.token=await deploy('ProtocolToken',[wallets[0].address]);cs.staking=await deploy('ProtocolStaking',[wallets[0].address,cs.token.target,cs.collateral.target]);cs.oracle=await deploy('LabOracle',[wallets[0].address,wallets[2].address,wallets[1].address]);
cs.exchange=await deploy('ReconstructedLabExchange',[wallets[0].address,wallets[1].address,wallets[5].address,cs.collateral.target,cs.oracle.target,cs.token.target,cs.staking.target]);
await send(cs.token.wire(cs.exchange.target,cs.staking.target));await send(cs.staking.wire(cs.exchange.target));
const markets=[{id:1,symbol:'BTC',price:'82213.35',multiplier:'814598000000000000000'},{id:2,symbol:'ETH',price:'3000.00',multiplier:'483979000000000000000'}];
for(const m of markets){const risk={enabled:true,maxLeverage:100,delay:2,executionWindow:20,bustBufferBps:5,minMargin:'1000000',maxMargin:'1000000000000',sideCap:'300000000000000',impact:{base:E.parseEther('0.1'),rate:E.parseEther('15000'),position:m.multiplier,referenceUsd:E.parseEther('100000')}};await send(cs.exchange.configureMarket(m.id,risk));await send(cs.oracle.connect(signers[2]).publish(m.id,E.parseEther(m.price)));}
await send(cs.exchange.setOpensPaused(false));
for(let i=0;i<10;i++){await send(cs.collateral.connect(signers[5]).mint(wallets[i].address,E.parseUnits(i===5?'20000000':'25000',6)));await send(cs.collateral.connect(signers[i]).approve(cs.exchange.target,E.MaxUint256));if(i>=6&&i<=8)await send(cs.exchange.connect(signers[i]).deposit(E.parseUnits('10000',6)));}
await send(cs.exchange.connect(signers[5]).seedLiquidity(E.parseUnits('8000000',6)));
let nonce=100;
async function timestamp(){return Number((await p.send('eth_getBlockByNumber',['latest',false])).timestamp);}
async function publish(id,price){await send(cs.oracle.connect(signers[2]).publish(id,E.parseEther(price)));}
async function advance(){await p.send('evm_increaseTime',[3]);await p.send('evm_mine',[]);}
async function open(i,isLong,margin='100',leverage=20,market=1){const id=await cs.exchange.nextPosition(),oid=await cs.exchange.nextOrder();await send(cs.exchange.connect(signers[i]).request({user:wallets[i].address,market,positionId:0,margin:E.parseUnits(margin,6),leverage,isLong,priceLimit:E.parseEther(isLong?'1000000':'0.01'),nonce:nonce++,deadline:await timestamp()+20}));await advance();await publish(market,markets.find(m=>m.id===market).price);await send(cs.exchange.connect(signers[3]).execute(oid));return id;}
// Real local liquidation creates Carol's PART, not an administrator mint.
const carol=await open(8,true,'100',100);await publish(1,'80000');await send(cs.exchange.connect(signers[4]).liquidate(carol));await publish(1,markets[0].price);
await send(cs.token.connect(signers[8]).approve(cs.staking.target,E.MaxUint256));await send(cs.staking.connect(signers[8]).stake(await cs.token.balanceOf(wallets[8].address)));await send(cs.exchange.connect(signers[3]).pushFees());
await open(6,true,'500',20);await open(7,false,'350',10,2);
await send(cs.exchange.connect(signers[6]).setSession(wallets[9].address,await timestamp()+30*86400,E.parseUnits('5000',6)));
cs.governance=await deploy('ProtocolTimelock',[86400,wallets[0].address]);for(const key of ['token','staking','oracle','exchange'])await send(cs[key].transferOwnership(cs.governance.target));
const addresses=Object.fromEntries(Object.entries(cs).map(([k,c])=>[k,c.target]));
const hashes=Object.fromEntries(await Promise.all(Object.entries(addresses).map(async([k,a])=>[k,E.keccak256(await p.getCode(a))])));
await save('wallets.local.json',wallets);await writeFile(runtime+'/wallets.local.csv','index,name,role,address,privateKey\n'+wallets.map(w=>[w.index,w.name,w.role,w.address,w.privateKey].join(',')).join('\n')+'\n',{mode:0o600});
await save('deployment.local.json',{chainId:31337,contracts:addresses,runtimeHashes:hashes,markets,receipts,createdAt:new Date().toISOString(),compiler:build.compiler,accountOverrides});
await save('journal.local.json',[]);await save('operations.local.json',[]);await save('prices.local.json',Object.fromEntries(markets.map(m=>[m.id,[{time:Date.now(),price:Number(m.price)}]])));
console.log('Deployed and seeded: 10 local actors, 2 markets, 2 positions, Carol stake, Alice session, $8m house.');p.destroy();
