import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
const require=createRequire(new URL('../../protocol/package.json',import.meta.url)),solc=require('solc');
export const repo=path.resolve(import.meta.dirname,'../..');
const sources={};
for(const name of readdirSync(path.join(repo,'protocol/src')))if(name.endsWith('.sol'))sources['protocol/src/'+name]={content:readFileSync(path.join(repo,'protocol/src',name),'utf8')};
for(const name of ['demo/contracts/LabContracts.sol','reverse-engineered/settlement/SettlementMath.reconstructed.sol','reverse-engineered/token/MintCurve.reconstructed.sol'])sources[name]={content:readFileSync(path.join(repo,name),'utf8')};
const settings={optimizer:{enabled:true,runs:200},viaIR:true,evmVersion:'cancun',outputSelection:{'*':{'*':['abi','evm.bytecode.object','evm.deployedBytecode.object','metadata']}}};
const output=JSON.parse(solc.compile(JSON.stringify({language:'Solidity',sources,settings}),{import:name=>{try{return{contents:readFileSync(path.join(repo,'protocol/node_modules',name),'utf8')}}catch{return{error:'Unknown import '+name}}}}));
const errors=(output.errors||[]).filter(e=>e.severity==='error');if(errors.length)throw Error(errors.map(e=>e.formattedMessage).join('\n'));
const contracts={};for(const cs of Object.values(output.contracts))for(const[name,a]of Object.entries(cs)){contracts[name]=a;if(a.evm.deployedBytecode.object.length/2>24576)throw Error('Runtime too large: '+name);}
mkdirSync(path.join(repo,'demo/.runtime'),{recursive:true});
writeFileSync(path.join(repo,'demo/.runtime/compiled.local.json'),JSON.stringify({compiler:solc.version(),settings,contracts}));
writeFileSync(path.join(repo,'demo/build-info.json'),JSON.stringify({compiler:solc.version(),evmVersion:'cancun',sources:Object.fromEntries(Object.entries(sources).map(([k,v])=>[k,createHash('sha256').update(v.content).digest('hex')])),runtimeBytes:Object.fromEntries(['ReconstructedLabExchange','LabOracle','LabCollateral'].map(n=>[n,contracts[n].evm.deployedBytecode.object.length/2]))},null,2)+'\n');
console.log('Compiled reconstructed lab exchange and role-restricted local fixtures.');
