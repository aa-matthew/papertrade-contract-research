import solc from 'solc';
import {readFile,readdir,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=path.resolve(import.meta.dirname,'..');
const sources={};
async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())await walk(p);else if(e.name.endsWith('.sol'))sources[path.relative(root,p)]={content:await readFile(p,'utf8')};}}
await walk(path.join(root,'reverse-engineered'));
await walk(path.join(root,'local/interfaces'));
const input={language:'Solidity',sources,settings:{viaIR:true,optimizer:{enabled:true,runs:200},outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','storageLayout']}}}};
const output=JSON.parse(solc.compile(JSON.stringify(input)));
await mkdir(path.join(root,'reverse-engineered/build'),{recursive:true});
const sourceDigests=Object.fromEntries(Object.entries(sources).map(([name,value])=>[name,createHash('sha256').update(value.content).digest('hex')]));
await writeFile(path.join(root,'reverse-engineered/build/compilation.json'),JSON.stringify({compiler:solc.version(),settings:input.settings,sourceDigests,...output},null,2)+'\n');
const errors=(output.errors??[]).filter(x=>x.severity==='error');
for(const e of errors)console.error(e.formattedMessage);
console.log(JSON.stringify({compiler:solc.version(),sources:Object.keys(sources).length,contracts:Object.values(output.contracts??{}).reduce((n,x)=>n+Object.keys(x).length,0),errors:errors.length}));
if(errors.length)process.exitCode=1;
