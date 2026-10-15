import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ContractFactory,Contract,JsonRpcProvider,Wallet,ZeroAddress,isAddress,keccak256} from 'ethers';
export const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const json=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2);
export async function artifacts(){return JSON.parse(await readFile(path.join(root,'artifacts/compiled.json'),'utf8'));}
export function artifact(build,name){for(const contracts of Object.values(build.contracts))if(contracts[name])return contracts[name];throw Error('Unknown contract '+name);}
export function address(value,label){if(!isAddress(value??'')||value===ZeroAddress)throw Error('Supply verified nonzero '+label);return value;}
export async function send(p){const tx=await p;const receipt=await tx.wait();if(receipt.status!==1)throw Error('Transaction failed '+tx.hash);return receipt;}
export async function deployProtocol(signer,config,{local=false,retainOwner=false}={}){
  const build=await artifacts(), owner=await signer.getAddress(), receipts=[];
  async function deploy(name,args=[]){const a=artifact(build,name);const c=await new ContractFactory(a.abi,a.evm.bytecode.object,signer).deploy(...args);await c.waitForDeployment();const r=await c.deploymentTransaction().wait();receipts.push({contract:name,address:c.target,tx:r.hash,block:r.blockNumber});return c;}
  const collateral=local?await deploy('MockCollateral'):new Contract(config.collateral,['function decimals() view returns(uint8)'],signer);
  const token=await deploy('ProtocolToken',[owner]);
  const staking=await deploy('ProtocolStaking',[owner,token.target,collateral.target]);
  const guardian=local?(config.guardian||owner):config.guardian;
  const developer=local?(config.developer||owner):config.developer;
  const oracle=local?await deploy('MockOracle'):await deploy('StreamOracle',[owner,guardian,config.verifier,config.sequencer,config.recoveryGrace]);
  const exchange=await deploy('Exchange',[owner,guardian,developer,collateral.target,oracle.target,token.target,staking.target]);
  await send(token.wire(exchange.target,staking.target));await send(staking.wire(exchange.target));
  for(const m of config.markets){await send(exchange.configureMarket(m.id,m.risk));if(!local)await send(oracle.configure(m.id,m.feed));}
  if(local&&config.unpauseLocal)await send(exchange.setOpensPaused(false));
  let governance;
  if(!retainOwner){
    governance=await deploy('ProtocolTimelock',[config.timelockDelay,local?(config.governor||owner):config.governor]);
    for(const c of [token,staking,exchange,...(local?[]:[oracle])])await send(c.transferOwnership(governance.target));
  }
  return {collateral,token,staking,oracle,exchange,governance,receipts,build};
}
// Read-only target preflight; never writes chain state.
export async function preflight(config){
  const local=config.chainId===31337;
  if(!local&&![4663,46630].includes(config.chainId))throw Error('Unsupported target chain');
  const rpc=process.env.RPC_URL||config.rpcUrl;
  const u=new URL(rpc);
  if(local&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))throw Error('Local mode requires loopback RPC');
  if(!local){
    for(const field of ['collateral','verifier','guardian','developer','governor'])address(config[field],field);
    if(!isAddress(config.sequencer||''))throw Error('Explicit sequencer address required (zero disables feed)');
    if(config.sequencer===ZeroAddress&&!config.sequencerRiskAcknowledged)throw Error('Document/acknowledge missing sequencer uptime feed');
    if(config.unpauseLocal)throw Error('Remote must start paused');
    if(config.timelockDelay<86400)throw Error('Timelock >= 1 day required');
    for(const m of config.markets){if(!/^0x0003[0-9a-fA-F]{60}$/.test(m.feed?.id||''))throw Error('Verified v3 feed ID required');if(![8,18].includes(m.feed.decimals))throw Error('Confirm feed decimals');}
  }
  const provider=new JsonRpcProvider(rpc);
  try{
    const network=await provider.getNetwork();if(Number(network.chainId)!==config.chainId)throw Error('RPC chain ID mismatch');
    if(!local){
      for(const field of ['collateral','verifier',...(config.sequencer===ZeroAddress?[]:['sequencer'])])if(await provider.getCode(config[field])==='0x')throw Error(field+' has no bytecode');
      if(Number(await new Contract(config.collateral,['function decimals() view returns(uint8)'],provider).decimals())!==6)throw Error('Collateral must use 6 decimals');
    }
    // Cancun MCOPY support, using ephemeral code override in eth_call. Unsupported RPCs fail closed.
    const probe='0x000000000000000000000000000000000000c0DE';
    const result=await provider.send('eth_call',[{to:probe,data:'0x'},'latest',{[probe]:{code:'0x602a5f5260205f60205e60206020f3'}}]);
    if(BigInt(result)!==42n)throw Error('Cancun MCOPY probe failed');
    return {provider,local,chainId:config.chainId,block:await provider.getBlockNumber(),rpc};
  }catch(e){provider.destroy();throw e;}
}
export async function signerFor(provider,local){
  if(local)return provider.getSigner(0);
  if(!process.env.KEYSTORE_PATH||!process.env.KEYSTORE_PASSWORD)throw Error('Set KEYSTORE_PATH and KEYSTORE_PASSWORD for encrypted deployment wallet');
  return (await Wallet.fromEncryptedJson(await readFile(process.env.KEYSTORE_PATH,'utf8'),process.env.KEYSTORE_PASSWORD)).connect(provider);
}
export async function manifest(result,config,provider){
  const chainId=Number((await provider.getNetwork()).chainId);
  const contracts={};for(const name of ['collateral','token','staking','oracle','exchange','governance'])if(result[name])contracts[name]=result[name].target;
  const hashes={};for(const [name,a] of Object.entries(contracts))hashes[name]=keccak256(await provider.getCode(a));
  const data={version:1,createdAt:new Date().toISOString(),chainId,contracts,runtimeHashes:hashes,deployments:result.receipts,compiler:result.build.compiler,sourceDigests:result.build.sourceDigests,config};
  await mkdir(path.join(root,'deployments'),{recursive:true});const filename=path.join(root,'deployments',`${chainId}-${Date.now()}${chainId===31337?'.local':''}.json`);await writeFile(filename,json(data)+'\n');return filename;
}
