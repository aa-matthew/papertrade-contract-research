import {spawn} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
await mkdir(path.join(root,'inspection/rea'),{recursive:true});
const child=spawn('docker',['run','--rm','--platform','linux/amd64','--network','none','--mount',`type=bind,source=${root},target=/work,readonly`,'--mount',`type=bind,source=${path.join(root,'inspection/rea')},target=/results`,'papertrade-rea:6.5.0','node','/work/scripts/run-rea-container.mjs'],{stdio:'inherit'});
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.on('exit',code=>process.exitCode=code??1);
