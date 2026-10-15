import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {Interface,id} from 'ethers';
const root=new URL('../',import.meta.url);
const json=async p=>JSON.parse(await readFile(new URL(p,root),'utf8'));
const sha=x=>createHash('sha256').update(x).digest('hex');
test('REA evidence binds every selected carrier and decoded bytecode to archived inputs',async()=>{
 const run=await json('inspection/rea/run-manifest.json');assert.equal(run.artifacts.length,19);
 for(const item of run.artifacts){
  assert.equal(item.exitCode,0,item.contract);
  const evidence=await json(`inspection/rea/${item.contract}.stdout.json`);
  const raw=await readFile(new URL(item.path,root));
  assert.equal(sha(raw),evidence.subject.digest.sha256);
  assert.equal(sha(Buffer.from(raw.toString().trim().replace(/^0x/,''),'hex')),evidence.normalized_result.bytecode.sha256);
  for(const f of evidence.normalized_result.functions)assert.ok(f.bytecode_offset>=0&&f.bytecode_offset<evidence.normalized_result.bytecode.bytes);
 }
});
test('Recovered batch signature and exact tuple round-trip real archived calldata',async()=>{
 const signature='execute((address,bytes,bool,bytes32,bytes32)[])';assert.equal(id(signature).slice(0,10),'0x251fb27d');
 const iface=new Interface(['function '+signature]);
 const txs=await json('inspection/transaction-samples.json');let found=0;
 for(const x of txs){const tx=x.transaction;if(!tx?.input.startsWith('0x251fb27d'))continue;
  const args=iface.decodeFunctionData('execute',tx.input);assert.equal(iface.encodeFunctionData('execute',args),tx.input);found++;
 }
 assert.ok(found>0);
});
test('All reconstructed and input-only Solidity sources have a successful current compile',async()=>{
 const compilation=await json('reverse-engineered/build/compilation.json');
 assert.equal((compilation.errors??[]).filter(x=>x.severity==='error').length,0);
 for(const [name,digest]of Object.entries(compilation.sourceDigests))assert.equal(sha(await readFile(new URL(name,root))),digest,name);
 assert.ok(Object.keys(compilation.sourceDigests).length>=26);
});
