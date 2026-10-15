import {createRequire} from 'node:module';
import path from 'node:path';
import {readFile,writeFile} from 'node:fs/promises';
const require=createRequire(new URL('../../protocol/package.json',import.meta.url));
export const E=require('ethers');
export const dir=path.resolve(import.meta.dirname,'..'),runtime=path.join(dir,'.runtime');
export const json=x=>JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v,2);
export const roles=[['Governor','Timelock proposer / executor'],['Guardian','Pause opens/oracle; retire markets'],['Oracle operator','Publish scenario prices'],['Keeper','Execute orders, harvest and push fees'],['Liquidator','Permissionless liquidation'],['Treasury','LABUSD faucet, house donor, fee recipient'],['Alice','Long trader / session owner'],['Bob','Short trader'],['Carol','Participation staker'],['Session relayer','Alice’s budgeted session key']];
export async function read(name){return JSON.parse(await readFile(path.join(runtime,name),'utf8'));}
export async function save(name,data){await writeFile(path.join(runtime,name),json(data)+'\n',{mode:0o600});}
export async function connected(){const p=new E.JsonRpcProvider('http://127.0.0.1:9545',undefined,{cacheTimeout:-1});p.pollingInterval=100;if(Number((await p.getNetwork()).chainId)!==31337)throw Error('Refusing nonlocal chain');return p;}
export async function wait(txPromise){const tx=await txPromise,r=await tx.wait();if(r.status!==1)throw Error('Transaction reverted');return r;}
