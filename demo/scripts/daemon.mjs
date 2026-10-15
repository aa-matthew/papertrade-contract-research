import {spawn,execFileSync} from 'node:child_process';
import {open,readFile,writeFile,mkdir} from 'node:fs/promises';
import {dir,runtime} from './shared.mjs';
process.umask(0o077);const action=process.argv[2]||'start';await mkdir(runtime,{recursive:true,mode:0o700});
let pid;try{pid=JSON.parse(await readFile(runtime+'/service.local.json','utf8')).pid;}catch{}
function alive(){if(!pid)return false;try{process.kill(pid,0);return execFileSync('ps',['-p',String(pid),'-o','args='],{encoding:'utf8'}).includes(dir+'/scripts/start.mjs');}catch{return false;}}
if(action==='stop'){if(alive()){process.kill(pid,'SIGTERM');for(let i=0;i<100&&alive();i++)await new Promise(r=>setTimeout(r,100));if(alive())throw Error('Lab is still stopping; inspect service log');console.log('Stopped lab and saved state.');}else console.log('Lab not running.');}
else if(action==='status')console.log(alive()?'Lab running at http://127.0.0.1:4173 (PID '+pid+')':'Lab not running.');
else if(action==='start'){if(alive())console.log('Lab already running at http://127.0.0.1:4173');else{const log=await open(runtime+'/service.local.log','a');const child=spawn(process.execPath,[dir+'/scripts/start.mjs',...process.argv.slice(3)],{detached:true,stdio:['ignore',log.fd,log.fd],cwd:dir});await writeFile(runtime+'/service.local.json',JSON.stringify({pid:child.pid,startedAt:new Date().toISOString()}),{mode:0o600});child.unref();console.log('Starting persistent local lab. Open http://127.0.0.1:4173; logs: demo/.runtime/service.local.log');}}
else throw Error('Usage: daemon.mjs start|stop|status');
