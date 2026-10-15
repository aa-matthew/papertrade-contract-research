import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {root,json,preflight,signerFor,deployProtocol,manifest} from './lib.mjs';
const args=process.argv.slice(2), configName=args[args.indexOf('--config')+1];
if(!args.includes('--config')||!configName)throw Error('Usage: node scripts/deploy.mjs --config config/local.json [--broadcast]');
const config=JSON.parse(await readFile(path.resolve(root,configName),'utf8'));
const checked=await preflight(config);
try{
  console.log(json({mode:args.includes('--broadcast')?'broadcast':'plan only',chainId:checked.chainId,block:checked.block,contracts:['ProtocolToken','ProtocolStaking',checked.local?'MockOracle':'StreamOracle','Exchange','ProtocolTimelock'],config}));
  if(args.includes('--broadcast')){const signer=await signerFor(checked.provider,checked.local);const result=await deployProtocol(signer,config,{local:checked.local});console.log('Manifest: '+await manifest(result,config,checked.provider));}
}finally{checked.provider.destroy();}
