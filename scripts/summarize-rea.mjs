import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {id,Interface} from 'ethers';
const root=path.resolve(import.meta.dirname,'..');
const load=async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const save=async(p,v)=>writeFile(path.join(root,p),JSON.stringify(v,null,2)+'\n');
const run=await load('inspection/rea/run-manifest.json'),summary=[];
for(const a of run.artifacts){
 if(a.exitCode!==0)throw Error('REA failed for '+a.contract);
 const evidence=await load(`inspection/rea/${a.contract}.stdout.json`),r=evidence.normalized_result;
 const carrier=await readFile(path.join(root,a.path));
 if(createHash('sha256').update(carrier).digest('hex')!==a.carrierSha256)throw Error('Carrier changed: '+a.contract);
 if(evidence.subject.digest.sha256!==a.carrierSha256)throw Error('REA carrier mismatch');
 const decoded=Buffer.from(carrier.toString().trim().replace(/^0x/,''),'hex');
 if(createHash('sha256').update(decoded).digest('hex')!==r.bytecode.sha256)throw Error('Decoded-byte digest mismatch');
 summary.push({contract:a.contract,address:a.address,evidenceId:evidence.evidence_id,path:a.path,carrierSha256:a.carrierSha256,decodedSha256:r.bytecode.sha256,bytecodeBytes:r.bytecode.bytes,provider:evidence.provider,metadata:r.bytecode.metadata,functions:r.functions,discoveryCompleteness:r.discovery_completeness,runtimeExecution:r.runtime_execution});
}
await save('inspection/rea/summary.json',summary);
const annotations=[
 {contract:'BatchExecutor',selector:'0x251fb27d',validatedEncoding:'execute((address,bytes,bool,bytes32,bytes32)[])',correction:'REA inferred uint256[] / view; tuple validators and runtime call traces establish a nonpayable batch entry',evidence:'reverse-engineered/auth/FINDINGS.md'},
 {contract:'ExchangeLinkedLibrary',selector:'0x82296364',validatedArgumentTypes:['uint64','uint64','uint128','uint32','bool','uint256','uint256','uint256','uint256'],correction:'Nine calldata words; automated interface inference returned five',evidence:'reverse-engineered/settlement/FINDINGS.md'},
 {contract:'ExchangeLinkedLibrary',selector:'0x3f4e3626',validatedArgumentTypes:['uint256','address','uint256'],correction:'Third word is an amount, not bool',evidence:'reverse-engineered/settlement/Queue.pseudocode.txt'},
];
await save('inspection/rea/annotations.json',annotations);
const catalog=await load('inspection/selector-catalog.json');
for(const [contract,sig]of [['BatchExecutor','execute((address,bytes,bool,bytes32,bytes32)[])'],['PriceOracle','getExecutionPrice(uint32)'],['PriceOracle','getBBO(uint32)']]){
 const row=catalog[contract].find(x=>x.selector===id(sig).slice(0,10));
 if(!row)throw Error('No matching selector for '+sig);
 row.signatureCandidates=[sig,...row.signatureCandidates.filter(x=>x!==sig)];row.reconstructionEvidence='reverse-engineered/auth/FINDINGS.md';
}
await save('inspection/selector-catalog.json',catalog);
for(const [name,rows]of Object.entries(catalog)){
 const file=`inspection/abi/${name}.encoding-candidates.json`;
 const old=await load(file);old.selectors=rows;
 old.abi=JSON.parse(new Interface(rows.map(x=>x.signatureCandidates[0]).filter(Boolean).map(x=>'function '+x)).formatJson());
 await save(file,old);
}
console.log('Verified REA Evidence for',summary.length,'carriers;',summary.reduce((n,x)=>n+x.functions.length,0),'inferred selector entries');
