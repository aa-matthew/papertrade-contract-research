// Runs the published REA CLI without changing its provider/host checks.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
const root='/work';
const out='/results';await mkdir(out,{recursive:true});
const entries=JSON.parse(await readFile(root+'/inspection/contracts.json','utf8'));
const jobs=entries.map(c=>({contract:c.name,address:c.slots.implementation?.address??c.address,path:`upstream/contracts/${c.name}/${c.slots.implementation?.address?'implementation-runtime.hex':'runtime.hex'}`}));
jobs.push({contract:'ProtocolProxy',address:entries.find(x=>x.name==='Exchange').address,path:'upstream/contracts/Exchange/runtime.hex'});
const results=[];
async function analyze(job){
 const file=await readFile(root+'/'+job.path),sha256=createHash('sha256').update(file).digest('hex');
 const started=Date.now();
 const result=await new Promise(resolve=>{
  const child=spawn(process.execPath,[root+'/tools/rea-runtime/node_modules/rea-agents/scripts/rea.mjs','inspect-evm-interface',root+'/'+job.path,'hex','--json'],{stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',timedOut=false;
  child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);
  const timer=setTimeout(()=>{timedOut=true;child.kill('SIGTERM');},120000);
  child.on('error',e=>{clearTimeout(timer);resolve({error:e.message,stdout,stderr});});
  child.on('exit',(code,signal)=>{clearTimeout(timer);resolve({exitCode:code,signal,timedOut,stdout,stderr});});
 });
 const {stdout,stderr,...status}=result;
 await writeFile(`${out}/${job.contract}.stdout.json`,stdout);
 if(stderr)await writeFile(`${out}/${job.contract}.stderr.txt`,stderr);
 let evidence;try{evidence=JSON.parse(stdout);}catch{}
 const row={...job,carrierSha256:sha256,elapsedMs:Date.now()-started,...status,evidenceId:evidence?.id??evidence?.evidence_id??null};
 results.push(row);await writeFile(out+'/run-manifest.json',JSON.stringify({reaVersion:'6.5.0',nodeVersion:process.version,platform:process.platform,arch:process.arch,network:'disabled for analysis',artifacts:results},null,2)+'\n');
 console.log(job.contract,JSON.stringify({...status,elapsedMs:row.elapsedMs,outputBytes:stdout.length}));
}
let next=0;
await Promise.all([0,1].map(async()=>{while(next<jobs.length)await analyze(jobs[next++]);}));
if(results.some(r=>r.exitCode!==0))process.exitCode=1;
