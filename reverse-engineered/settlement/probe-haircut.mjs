import {AbiCoder} from 'ethers';import fs from 'node:fs';import assert from 'node:assert/strict';
const a=JSON.parse(fs.readFileSync('inspection/contracts.json')).find(x=>x.name==='ExchangeLinkedLibrary').address;
const W=10n**18n; const MAX=2n**256n-1n;
function model([raw,entry,exit,base,rate,pos,ref]){const d=entry>exit?entry-exit:exit-entry;if(!d)return 0n;const move=d*W/entry;const den1=move*rate/W;const t1=den1===0n?MAX:W*W/den1;const den2=1000000n*move*pos/W;const t2=den2===0n?MAX:ref*W/den2;if(t1>W*W||t2>W*W)return 0n;return raw*((W-base)*W/(W+t1+t2))/W;}
const tests=[];
for(const delta of [0n,1n,20n,100n,1000n,10000n,-10000n])for(const raw of [100n*W,137n*W+19n]){
 const args=[raw,1000000n,1000000n+delta,W/10n,15000n*W,814598n*W/1000n,100000n*W];
 const data='0xb67f3dd7'+AbiCoder.defaultAbiCoder().encode(['uint256','uint64','uint64','uint256','uint256','uint256','uint256'],args).slice(2);
 const r=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'eth_call',params:[{to:a,data},'latest']})});const out=await r.json();let actual=out.result?BigInt(out.result):null;let expected=model(args);tests.push({args:args.map(String),actual:String(actual),expected:String(expected),pass:actual===expected,error:out.error});
 if(delta===10000n&&raw===100n*W){const tr=await fetch('http://127.0.0.1:8545',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method:'debug_traceCall',params:[{to:a,data},'latest',{disableMemory:true,disableStorage:true}]})});fs.writeFileSync('reverse-engineered/settlement/probe-debug_traceCall.json',JSON.stringify({a,args:args.map(String),data,response:await tr.json()},null,2));}
}
fs.writeFileSync('reverse-engineered/settlement/haircut-tests.json',JSON.stringify({endpoint:'http://127.0.0.1:8545',readOnly:true,selector:'0xb67f3dd7',tests},null,2));console.log(tests.map(x=>({delta:String(BigInt(x.args[2])-BigInt(x.args[1])),actual:x.actual,expected:x.expected,pass:x.pass})));assert(tests.every(x=>x.pass));
