import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import solc from 'solc';
import {createHash} from 'node:crypto';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const sources={};
async function walk(dir){for(const e of await readdir(path.join(root,dir),{withFileTypes:true})){const name=dir+'/'+e.name;if(e.isDirectory())await walk(name);else if(name.endsWith('.sol'))sources[name]={content:await readFile(path.join(root,name),'utf8')};}}
await walk('src');await walk('test');
const dependencies={};
function findImports(name){try{const contents=requireText(path.join(root,'node_modules',name));dependencies[name]={content:contents};return {contents};}catch{return {error:'Missing dependency '+name};}}
import {readFileSync} from 'node:fs';
const requireText=p=>readFileSync(p,'utf8');
const settings={optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'cancun',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','metadata','storageLayout']}}};
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings}),{import:findImports}));
const errors=(output.errors??[]).filter(x=>x.severity==='error');
for(const e of errors)console.error(e.formattedMessage);
if(errors.length)process.exit(1);
const artifacts={compiler:solc.version(),settings,sourceDigests:Object.fromEntries(Object.entries(sources).map(([n,s])=>[n,createHash('sha256').update(s.content).digest('hex')])),contracts:output.contracts};
await mkdir(path.join(root,'artifacts'),{recursive:true});await writeFile(path.join(root,'artifacts/compiled.json'),JSON.stringify(artifacts,null,2)+'\n');
await writeFile(path.join(root,'artifacts/standard-input.json'),JSON.stringify({language:'Solidity',sources:{...sources,...dependencies},settings},null,2)+'\n');
const sizes=Object.entries(output.contracts).filter(([s])=>s.startsWith('src/')).flatMap(([s,cs])=>Object.entries(cs).map(([n,a])=>({source:s,name:n,bytes:a.evm.deployedBytecode.object.length/2})));
for(const x of sizes){console.log(x.name+': '+x.bytes+' runtime bytes');if(x.bytes>24576)throw Error('EIP-170 size exceeded: '+x.name);}
await writeFile(path.join(root,'artifacts/build-info.json'),JSON.stringify({compiler:artifacts.compiler,settings:{optimizer:settings.optimizer,viaIR:settings.viaIR,evmVersion:settings.evmVersion},sourceDigests:artifacts.sourceDigests,sizes},null,2)+'\n');
