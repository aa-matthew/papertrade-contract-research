import {spawn} from 'node:child_process';
import {mkdir,readFile,access,chmod} from 'node:fs/promises';
import path from 'node:path';
import {dir,runtime,E,save} from './shared.mjs';
import {forkCache} from './fork-cache.mjs';
process.umask(0o077);await mkdir(runtime,{recursive:true,mode:0o700});await chmod(runtime,0o700);
async function exists(p){try{await access(p);return true;}catch{return false;}}
if(!await exists(path.join(dir,'../protocol/node_modules/solc')))throw Error('Run npm ci --prefix protocol first');
if(!await exists(runtime+'/compiled.local.json')||process.argv.includes('--rebuild'))await new Promise((resolve,reject)=>{const c=spawn(process.execPath,[dir+'/scripts/compile.mjs'],{stdio:'inherit'});c.on('exit',n=>n===0?resolve():reject(Error('Compile failed')));});
const endpoint=process.env.ROBINHOOD_FORK_URL||'https://robinhood.rpc.pinax.network';
const forkClient=await forkCache(endpoint),rpc=forkClient.source;
if(Number(BigInt(await rpc('eth_chainId')))!==4663)throw Error('Expected Robinhood mainnet source chain 4663');
let fork;
if(await exists(runtime+'/fork.local.json'))fork=JSON.parse(await readFile(runtime+'/fork.local.json','utf8'));
else{const height=await rpc('eth_blockNumber'),block=await rpc('eth_getBlockByNumber',[height,false]);fork={sourceChainId:4663,blockNumber:Number(BigInt(height)),blockHash:block.hash,blockTimestamp:Number(BigInt(block.timestamp)),capturedAt:new Date().toISOString()};}
const anchor=await rpc('eth_getBlockByNumber',['0x'+fork.blockNumber.toString(16),false]);
if(anchor?.hash!==fork.blockHash)throw Error('Pinned Robinhood block hash mismatch');
// Check a historical state read, not just block availability, before resuming.
const probe=await rpc('eth_getStorageAt',['0x0000000000000000000000000000000000000001','0x0','0x'+fork.blockNumber.toString(16)]);
if(!/^0x[0-9a-fA-F]{64}$/.test(probe))throw Error('Archive storage probe failed');
fork.originalEndpoint??=fork.endpoint||endpoint;fork.endpoint=endpoint;fork.lastVerifiedAt=new Date().toISOString();await save('fork.local.json',fork);
const sourceProxy=await forkClient.serve(fork);
// Never connect a transaction signer to upstream. All mutations use the loopback fork.
const args=['--host','127.0.0.1','--port','9545','--chain-id','31337','--fork-url','http://127.0.0.1:9546','--fork-chain-id','4663','--fork-header','User-Agent: Mozilla/5.0','--fork-block-number',String(fork.blockNumber),'--hardfork','cancun','--accounts','10','--balance','10000','--state',runtime+'/anvil-state.local.json','--state-interval','15','--no-cors','--silent'];
const anvil=spawn(process.env.ANVIL_BIN||'anvil',args,{stdio:['ignore','inherit','inherit'],env:{...process.env,RUST_LOG:'error'}});
let server;let stopping=false;
function stop(){if(stopping)return;stopping=true;server?.kill('SIGTERM');anvil.kill('SIGTERM');sourceProxy.close();}
process.on('SIGINT',stop);process.on('SIGTERM',stop);anvil.on('exit',code=>{if(!stopping){server?.kill();process.exit(code||1);}});
let ready=false;for(let i=0;i<100;i++){try{const r=await fetch('http://127.0.0.1:9545',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_chainId',params:[]})});if((await r.json()).result==='0x7a69'){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}
if(!ready){stop();throw Error('Fork did not start');}
try{
 const p=new E.JsonRpcProvider('http://127.0.0.1:9545');await p.send('anvil_setLoggingEnabled',[false]);let valid=false;
 if(await exists(runtime+'/deployment.local.json')){const m=JSON.parse(await readFile(runtime+'/deployment.local.json','utf8'));valid=(await p.getCode(m.contracts.exchange))!=='0x';}
 p.destroy();
 if(process.argv.includes('--redeploy'))valid=false;
 if(!valid)await new Promise((resolve,reject)=>{const c=spawn(process.execPath,[dir+'/scripts/deploy.mjs'],{stdio:'inherit'});c.on('exit',n=>n===0?resolve():reject(Error('Deployment failed')));});
 server=spawn(process.execPath,[dir+'/scripts/server.mjs'],{stdio:'inherit'});server.on('exit',code=>{if(!stopping){stop();process.exit(code||1);}});
 console.log(`Robinhood source fork #${fork.blockNumber}; local chain 31337 at 127.0.0.1:9545. UI: http://127.0.0.1:4173`);
}catch(e){stop();throw e;}
