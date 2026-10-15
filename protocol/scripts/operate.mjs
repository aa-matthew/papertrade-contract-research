import {readFile} from 'node:fs/promises';
import {JsonRpcProvider,Contract,Interface} from 'ethers';
import {artifacts,artifact,json,send,signerFor} from './lib.mjs';
const [command,file,...args]=process.argv.slice(2);
if(!file)throw Error('Usage: node scripts/operate.mjs status|call|encode|send MANIFEST [contract function JSON_ARGS]');
const m=JSON.parse(await readFile(file,'utf8')),provider=new JsonRpcProvider(process.env.RPC_URL||m.config.rpcUrl),build=await artifacts();
const names={exchange:'Exchange',token:'ProtocolToken',staking:'ProtocolStaking',oracle:m.chainId===31337?'MockOracle':'StreamOracle',governance:'ProtocolTimelock',collateral:m.chainId===31337?'MockCollateral':'IERC20Metadata'};
try{
  if(Number((await provider.getNetwork()).chainId)!==m.chainId)throw Error('Chain mismatch');
  if(command==='status'){
    const c=new Contract(m.contracts.exchange,artifact(build,'Exchange').abi,provider);
    const fields=['opensPaused','owner','guardian','houseCash','totalBalances','lockedMargin','stakerFees','developerFees','totalQueued','openCount','pendingOpenCount','DAILY_PAYOUT_LIMIT','dailyPayoutRemaining','cashInvariant'];
    const values=await Promise.all(fields.map(f=>c[f]()));console.log(json(Object.fromEntries(fields.map((f,i)=>[f,values[i]]))));
  }else{
    const [key,fn,raw='[]']=args,abi=artifact(build,names[key]).abi,params=JSON.parse(raw),iface=new Interface(abi),to=m.contracts[key];
    if(!to)throw Error('Missing deployed contract');
    const data=iface.encodeFunctionData(fn,params),value=BigInt(process.env.TX_VALUE_WEI||'0');
    if(command==='encode')console.log(json({chainId:m.chainId,to,data,value}));
    else if(command==='call')console.log(json(await new Contract(to,abi,provider)[fn](...params,{value})));
    else if(command==='send'){
      if(!args.includes('--broadcast'))throw Error('Explicit --broadcast required');
      const signer=await signerFor(provider,m.chainId===31337);console.log(json({transaction:(await send(signer.sendTransaction({to,data,value}))).hash}));
    }else throw Error('Unknown command');
  }
}finally{provider.destroy();}
