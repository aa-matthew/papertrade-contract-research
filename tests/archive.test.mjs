import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {id,Interface,TypedDataEncoder} from 'ethers';
const json=async p=>JSON.parse(await readFile(new URL('../'+p,import.meta.url),'utf8'));
test('All documented contracts have archived deployed code and resolved implementation code',async()=>{
 const official=await json('inspection/official-addresses.json'),all=await json('inspection/contracts.json');
 for(const [name,address]of Object.entries(official)){
  const entry=all.find(x=>x.name===name);assert.equal(entry.address,address);
  const raw=(await readFile(new URL(`../upstream/contracts/${name}/runtime.hex`,import.meta.url),'utf8')).trim();
  assert.match(raw,/^0x[0-9a-f]+$/);assert.equal((raw.length-2)/2,entry.runtimeBytes);
  if(entry.slots.implementation?.address){const impl=(await readFile(new URL(`../upstream/contracts/${name}/implementation-runtime.hex`,import.meta.url),'utf8')).trim();assert.ok(impl.length>2);}
 }
});
test('Every named signature candidate hashes to the observed deployed selector',async()=>{
 const catalog=await json('inspection/selector-catalog.json');
 for(const [name,rows] of Object.entries(catalog))for(const row of rows)for(const sig of row.signatureCandidates)assert.equal(id(sig).slice(0,10),row.selector,`${name}: ${sig}`);
});
test('Published EIP-712 OpenPosition and Close hashes match onchain constants',async()=>{
 const types=(await json('inspection/typed-data.json')).find(x=>x.value).value;
 const reads=await json('inspection/onchain-reads.json');
 for(const [name,getter]of [['OpenPosition','OPEN_POSITION_TYPEHASH()'],['Close','CLOSE_TYPEHASH()']]){
  const typeString=TypedDataEncoder.from({[name]:types[name]}).encodeType(name);
  const recorded=reads.find(x=>x.contract==='SessionKeyManager'&&x.signatureCandidate===getter);
  assert.equal(id(typeString),recorded.raw);
 }
});
test('Original source files match their archived compiler inputs',async()=>{
 const summary=await json('inspection/source-extraction.json');
 for(const item of summary.filter(x=>x.files)){
  const input=await json(`upstream/contracts/${item.contract}/${item.role}-compiler-input.json`);
  for(const [name,value]of Object.entries(input.sources))if(typeof value.content==='string'){
   assert.equal(await readFile(new URL(`../upstream/sources/${item.contract}/${item.role}/${name}`,import.meta.url),'utf8'),value.content);
  }
 }
});
test('All upstream and readable archive checksums match',async()=>{
 const {createHash}=await import('node:crypto');const manifest=await json('inspection/sha256.json');
 for(const [name,expected]of Object.entries(manifest))assert.equal(createHash('sha256').update(await readFile(new URL('../'+name,import.meta.url))).digest('hex'),expected,name);
});
