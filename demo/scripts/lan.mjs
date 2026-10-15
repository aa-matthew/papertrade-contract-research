// Host-side controls only; never served to participants.
import os from 'node:os';
import {mkdir,writeFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {save,read,dir,runtime} from './shared.mjs';
const ip=process.env.LAB_LAN_IP||Object.values(os.networkInterfaces()).flat().find(a=>a.family==='IPv4'&&!a.internal&&/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address))?.address;
const command=process.argv[2]||'status';
if(command==='start'){
 if(!ip)throw Error('No LAN IPv4 found; set LAB_LAN_IP');
 const r=spawnSync(process.execPath,[dir+'/scripts/daemon.mjs','stop'],{stdio:'inherit'});if(r.status!==0)process.exit(r.status);
 try{await read('lan-control.local.json');}catch{await save('lan-control.local.json',{feed:false});}
 const p=spawnSync(process.execPath,[dir+'/scripts/daemon.mjs','start'],{stdio:'inherit',env:{...process.env,LAB_SHARED:'1',LAB_LAN_HOST:ip+':4173'}});if(p.status!==0)process.exit(p.status);
 try{await mkdir(runtime+'/participants',{recursive:true,mode:0o700});for(const w of await read('wallets.local.json'))await writeFile(`${runtime}/participants/${String(w.index).padStart(2,'0')}-${w.name.replaceAll(' ','-')}.txt`,`${w.name} — ${w.role}\nDEVELOPMENT WALLET — NO REAL ASSETS\n\nUI: http://${ip}:4173\nRPC: http://${ip}:4173/rpc\nChain ID: 31337\nCurrency: ETH\n\nAddress: ${w.address}\nPrivate key to import into your test wallet: ${w.privateKey}\n\nOpen UI and click Connect wallet. Selecting another actor changes the view only.\nHost must enable Binance + keeper for delayed orders to fill.\n`,{mode:0o600});}catch(e){console.error('Participant exports unavailable yet:',e.message);}
 console.log(`Shared persistent Robinhood fork: http://${ip}:4173\nWallet RPC: http://${ip}:4173/rpc · chain 31337 · ETH\nStart real Binance + keeper: npm run lan:feed --prefix demo -- on\nPrivate wallets: ${runtime}/wallets.local.json`);
}else if(command==='feed'){
 const enabled=process.argv[3]==='on';if(!['on','off'].includes(process.argv[3]))throw Error('Use feed on|off');
 await save('lan-control.local.json',{feed:enabled});console.log(enabled?'Binance + keeper enabled; all transactions persist.':'Binance + keeper stopping; chain and participant transactions remain.');
}else if(command==='status'){
 const r=await fetch('http://127.0.0.1:4173/api/state',{signal:AbortSignal.timeout(5000)});const s=await r.json();if(!r.ok)throw Error(s.error);console.log(JSON.stringify({url:ip?`http://${ip}:4173`:null,chainId:s.chainId,block:s.block,shared:s.shared},null,2));
}else throw Error('Use start|feed on|feed off|status');
