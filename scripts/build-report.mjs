import {readFile,writeFile,readdir,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {Interface,keccak256} from 'ethers';
const root=path.resolve(import.meta.dirname,'..');
const load=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const save=async(p,v)=>{await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),typeof v==='string'?v:JSON.stringify(v,null,2)+'\n');};
const entries=await load('inspection/contracts.json'),catalog=await load('inspection/selector-catalog.json');
for(let i=0;i<entries.length;i++)entries[i]=await load(`upstream/contracts/${entries[i].name}/metadata.json`);
await save('inspection/contracts.json',entries);
const counts={addresses:entries.length,implementations:entries.filter(x=>x.slots.implementation?.address).length,sourceFiles:0,selectors:0};
let report='# Contract inventory\n\nCaptured from the official address list and discovered dependencies. `runtime.hex` is deployed code, not Solidity source. Source status refers to the explorer publication; signature candidates are not complete verified ABIs.\n\n| Contract | Address | Implementation | Source |\n|---|---|---|---|\n';
for(const c of entries){
 const m=c.implementation??c.proxy;
 report+=`| ${c.name} | ${c.address} | ${c.slots.implementation?.address??'—'} | ${m?.sourceStatus??'unknown'} |\n`;
 const signatures=(catalog[c.name]??[]).map(x=>x.signatureCandidates[0]).filter(Boolean);
 counts.selectors+=(catalog[c.name]??[]).length;
 const abi=new Interface(signatures.map(x=>'function '+x));
 const structs=[];
 function solidityType(p){
  if(p.baseType==='array')return solidityType(p.arrayChildren)+'['+(p.arrayLength===-1?'':p.arrayLength)+']';
  if(p.baseType==='tuple'){
   const name='RecoveredTuple'+structs.length;
   const fields=p.components.map((x,i)=>solidityType(x)+' field'+i+';');
   structs.push(`    struct ${name} { ${fields.join(' ')} }`);return name;
  }
  return p.type;
 }
 const declarations=abi.fragments.filter(x=>x.type==='function').map(f=>{
  const inputs=f.inputs.map((p,i)=>solidityType(p)+(['array','tuple'].includes(p.baseType)||['bytes','string'].includes(p.type)?' calldata':'')+' arg'+i);
  return `    function ${f.name}(${inputs.join(', ')}) external;`;
 });
 const iface=`// SPDX-License-Identifier: UNLICENSED\npragma solidity >=0.8.0;\n\n// LOCALLY RECONSTRUCTED INPUT SIGNATURES ONLY. Not original protocol source.\n// Names are selector-matched candidates; collisions possible.\n// Return types, mutability and access control are deliberately unspecified.\n// Use only for calldata inspection; consult selector-catalog.json for unresolved functions.\ninterface I${c.name}InputSignatures {\n${[...structs,...declarations].join('\n')}\n}\n`;
 await save(`local/interfaces/I${c.name}InputSignatures.sol`,iface);
}
const recursiveFiles=async dir=>{const files=[];for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);files.push(...(e.isDirectory()?await recursiveFiles(p):[p]));}return files;};
for(const p of await recursiveFiles(path.join(root,'upstream/sources')))if(p.endsWith('.sol'))counts.sourceFiles++;
await save('inspection/CONTRACTS.md',report);
await save('inspection/inventory-summary.json',counts);
const txs=await load('inspection/transaction-samples.json');
const byAddress=new Map(entries.map(c=>[c.address.toLowerCase(),c.name]));
const decoded=[];
const plain=x=>JSON.parse(JSON.stringify(x,(_,v)=>typeof v==='bigint'?v.toString():v));
function decodeInput(to,input){
 const contract=byAddress.get(to?.toLowerCase());
 const sig=(catalog[contract]??[]).find(x=>x.selector===input.slice(0,10))?.signatureCandidates[0];
 const out={contract:contract??null,address:to,selector:input.slice(0,10),signatureCandidate:sig??null};
 if(sig){try{const iface=new Interface(['function '+sig]);out.arguments=plain(iface.decodeFunctionData(sig,input));}catch(e){out.decodeError=e.message;}}
 return out;
}
for(const item of txs){
 const tx=item.transaction;if(!tx)continue;
 const out={hash:tx.hash,blockNumber:tx.blockNumber,success:item.receipt?.status==='0x1',...decodeInput(tx.to,tx.input)};
 // Exact input shape recovered from selector + bytecode validators + readonly probes.
 if(out.contract==='BatchExecutor'&&out.selector==='0x251fb27d'){
  try{
   const {AbiCoder}=await import('ethers');const coder=AbiCoder.defaultAbiCoder();
   const type='tuple(address target,bytes data,bool allowFailure,bytes32 failureGroup,bytes32 itemId)[]';
   const [calls]=coder.decode([type],'0x'+tx.input.slice(10));
   if(coder.encode([type],[calls]).toLowerCase()!=='0x'+tx.input.slice(10).toLowerCase())throw Error('Round-trip mismatch');
   out.batchShape='execute((address,bytes,bool,bytes32,bytes32)[]); field names are semantic labels corroborated by bytecode and local probes';
   out.calls=calls.map(c=>({...decodeInput(c.target,c.data),allowFailure:c.allowFailure,failureGroup:c.failureGroup,itemId:c.itemId,rawData:c.data}));
  }catch(e){out.batchDecodeError=e.message;}
 }
 decoded.push(out);
}
await save('inspection/decoded-transactions.json',decoded);
const hashes={};const {createHash}=await import('node:crypto');
for(const base of ['upstream','readable'])for(const p of await recursiveFiles(path.join(root,base)))hashes[path.relative(root,p)]=createHash('sha256').update(await readFile(p)).digest('hex');
await save('inspection/sha256.json',hashes);
console.log(counts,'decoded transactions',decoded.length);
