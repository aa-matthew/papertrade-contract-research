import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {E,read,connected,dir,json} from './shared.mjs';
const checks=[],check=(name,pass,detail)=>{checks.push({name,pass:!!pass,...(detail?{detail}:{} )});if(!pass)throw Error(name);};let p;
try{
 const response=await fetch('http://127.0.0.1:4173/api/state',{signal:AbortSignal.timeout(20000)});check('UI backend responds',response.ok);const s=await response.json(),d=await read('deployment.local.json');p=await connected();
 check('Local chain ID isolates signatures',s.chainId===31337);check('No regression checkpoint active',!s.testing);check('Source is Robinhood mainnet',s.fork.sourceChainId===4663);check('Ten distinct funded wallets',s.actors.length===10&&new Set(s.actors.map(a=>a.address)).size===10&&s.accounts.every(a=>BigInt(a.native)>0n));
 const source=await p.getBlock(s.fork.blockNumber);check('Pinned source block hash retained',source.hash===s.fork.blockHash);
 for(const [key,address]of Object.entries(d.contracts))check('Runtime hash: '+key,E.keccak256(await p.getCode(address))===d.runtimeHashes[key]);
 check('Known dev accounts are plain local EOAs',(await Promise.all(s.actors.map(a=>p.getCode(a.address)))).every(code=>code==='0x'));
 check('Exchange owner is timelock',s.metrics.owner.toLowerCase()===d.contracts.governance.toLowerCase());check('Cash invariant',s.metrics.cashInvariant===true);
 const build=await read('compiled.local.json'),x=new E.Contract(d.contracts.exchange,build.contracts.ReconstructedLabExchange.abi,p),cash=new E.Contract(d.contracts.collateral,build.contracts.LabCollateral.abi,p);
 check('Actual custody covers accounted assets',(await cash.balanceOf(x.target))>=(await x.accountedAssets()));check('Hard daily cap remains 5m collateral',await x.DAILY_PAYOUT_LIMIT()===5_000_000_000_000n);check('Daily budget within bounds',BigInt(s.metrics.dailyPayoutRemaining)>=0n&&BigInt(s.metrics.dailyPayoutRemaining)<=5_000_000_000_000n);
 const info=JSON.parse(await readFile(path.join(dir,'build-info.json'),'utf8'));for(const [name,expected]of Object.entries(info.sources)){const actual=createHash('sha256').update(await readFile(path.join(dir,'..',name))).digest('hex');check('Compiled source matches: '+name,actual===expected);}
 check('Recovered helper identity exposed',(await x.reconstruction()).includes('Recovered SettlementMath'));
 const html=await(await fetch('http://127.0.0.1:4173/')).text();check('UI document loads',html.includes('robinpaper')&&html.includes('Active wallet'));
 const report={checkedAt:new Date().toISOString(),passed:true,checks,sourceFork:{chainId:4663,block:s.fork.blockNumber,hash:s.fork.blockHash},local:{chainId:31337,block:s.block,positions:s.positions.length,actors:s.actors.length,houseCash:s.metrics.houseCash,queued:s.metrics.totalQueued,oraclePaused:s.oraclePaused,heartbeat:s.heartbeat}};
 await writeFile(path.join(dir,'.runtime/last-check.local.json'),json(report)+'\n',{mode:0o600});console.log(json(report));
}catch(e){console.error(json({passed:false,error:e.message,checks}));process.exitCode=1;}finally{p?.destroy();}
