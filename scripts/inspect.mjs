import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { Interface, id, decodeBytes32String, AbiCoder } from 'ethers';

const root = path.resolve(import.meta.dirname,'..');
const load = async p=>JSON.parse(await readFile(path.join(root,p),'utf8'));
const save = async(p,v)=>{await mkdir(path.dirname(path.join(root,p)),{recursive:true});await writeFile(path.join(root,p),JSON.stringify(v,null,2)+'\n');};
const contracts=await load('inspection/contracts.json');
const snapshot=await load('inspection/snapshot.json');
const endpoint=process.env.PAPERTRADE_RPC_URL??'https://rpc.hyperliquid.xyz/evm';
const block=process.env.PAPERTRADE_BLOCK??snapshot.block;
function rpc(method,params){
  if(!['eth_call','eth_getCode','eth_getStorageAt','eth_getLogs','eth_getTransactionByHash','eth_getTransactionReceipt','eth_chainId','eth_blockNumber'].includes(method))throw Error('Read-only RPC method required');
  const raw=execFileSync('curl',['-sSL','--max-time','30',endpoint,'-H','Content-Type: application/json','--data-binary',JSON.stringify({jsonrpc:'2.0',id:1,method,params})],{maxBuffer:20*1024*1024}).toString();
  const data=JSON.parse(raw);if(data.error)throw Error(JSON.stringify(data.error));return data.result;
}
const documentedCandidates=[
 'openPositionBySig(address,uint32,bool,uint128,uint32,bool,uint256,uint64,uint8,bytes32,bytes32)',
 'closeBySig(address,uint256[],uint256,uint64,uint8,bytes32,bytes32)',
 'closePositionsBySig(address,uint256[],uint256,uint64,uint8,bytes32,bytes32)',
 'withdrawToCoreBySig(address,uint256,uint256,uint64,uint8,bytes32,bytes32)',
 'registerSessionKeyBySig(address,address,uint64,address,uint256,uint64,uint8,bytes32,bytes32)',
 'stakeBySig(address,uint256,uint256,uint64,uint8,bytes32,bytes32)',
 'unstakeBySig(address,uint256,uint256,uint64,uint8,bytes32,bytes32)',
 'claimBySig(address,uint256,uint64,uint8,bytes32,bytes32)',
 'distributeBySig(address,uint256,uint64,uint8,bytes32,bytes32)',
 'withdrawToCore(uint256)', 'openPosition(uint32,bool,uint128,uint32)',
 'openPosition(uint32,bool,uint128,uint32,bool)',
 'executeBatch(bytes[])', 'execute(bytes[])', 'batchExecute(bytes[])',
 'execute((address,bytes,bool,bytes32,bytes32)[])', 'getExecutionPrice(uint32)',
 'getBBO(uint32)', 'getBbo(uint32)', 'getBboMid(uint32)', 'getMidPrice(uint32)',
 'stakerRewardCapUsd()', 'currentMintRate()', 'transfersEnabled()',
 'setTransfersEnabled(bool)', 'signerThree()', 'token()',
 'paperStaking()', 'staking()', 'stakerRewardCapUsd()', 'stakerRewardCap()',
 'currentMintRate()', 'mintRate()', 'paused()', 'initialized()',
];
// Public-database names are candidates, not verified ABI declarations.
const catalog={}, reads=[], links=[];
const addressNames = new Map(contracts.map(c=>[c.address.toLowerCase(),c.name]));
const addressGetters=new Set(['owner','oracle','sessionKeyManager','authorizedExecutor','marketKeeper','pauseGuardian','authorizedKeeper','proxyFactory','devFeeRecipient','paperTokenomics','exchange','paperToken','stakeToken','rewardToken','minter','stakingContract','authorizedCaller','authorizedDeployer','signerOne','signerTwo','signerThree','token','paperStaking','staking','implementation','admin']);
for(const c of contracts){
  const folder=`upstream/contracts/${c.name}`;
  const code=await readFile(path.join(root,folder,c.slots.implementation?.address?'implementation-runtime.hex':'runtime.hex'),'utf8');
  let raw;
  try{raw=await readFile(path.join(root,folder,'selectors.txt'),'utf8');}catch{raw=execFileSync('cast',['selectors','--resolve',code.trim()],{maxBuffer:2e6}).toString();await writeFile(path.join(root,folder,'selectors.txt'),raw);}
  const rows=raw.trim().split('\n').filter(Boolean).map(line=>{
    const [selector,inferredArguments,inferredMutability,names='']=line.split('\t').map(x=>x.trim());
    const candidates=names.split('|').filter(Boolean);
    for(const sig of documentedCandidates)if(id(sig).slice(0,10)===selector&&!candidates.includes(sig))candidates.unshift(sig);
    return {selector,inferredArguments,inferredMutability,signatureCandidates:candidates,provenance:'bytecode analysis; signature names from public database or documented-name hash match; collision possible'};
  });
  catalog[c.name]=rows;
  const abi=[];
  for(const row of rows){
    if(row.signatureCandidates[0]){
      try{const fragment=Interface.from([`function ${row.signatureCandidates[0]}`]).fragments[0];abi.push(JSON.parse(fragment.format('json')));}catch{}
    }
    if(row.inferredArguments===''&&['view','pure'].includes(row.inferredMutability)){
      const record={contract:c.name,address:c.address,requestedBlock:block,consistency:'live-read; public RPC ignores historical state block tags',capturedAt:new Date().toISOString(),selector:row.selector,signatureCandidate:row.signatureCandidates[0]??null};
      try{
        record.raw=rpc('eth_call',[{to:c.address,data:row.selector},block]);
        if(record.raw.length===66){
          record.uint256=BigInt(record.raw).toString();
          record.int256=AbiCoder.defaultAbiCoder().decode(['int256'],record.raw)[0].toString();
          if(record.signatureCandidate && addressGetters.has(record.signatureCandidate.split('(')[0])){
            record.addressValue='0x'+record.raw.slice(-40);record.linkedContract=addressNames.get(record.addressValue)??null;
            links.push({from:c.name,getter:record.signatureCandidate,to:record.linkedContract??record.addressValue,address:record.addressValue});
          }
        }
        if(['name()','symbol()'].includes(record.signatureCandidate))record.stringValue=AbiCoder.defaultAbiCoder().decode(['string'],record.raw)[0];
      }catch(e){record.error=e.message;}
      reads.push(record);
    }
  }
  await save(`inspection/abi/${c.name}.encoding-candidates.json`,{warning:'Partial signatures for encoding and research only. Return types and mutability are intentionally NOT asserted. This is not an original or complete ABI.',abi,selectors:rows});
  execFileSync('cast',['disassemble',code.trim()],{maxBuffer:20*1024*1024,stdio:['ignore',await import('node:fs').then(fs=>fs.openSync(path.join(root,folder,'disassembly.txt'),'w')),'pipe']});
  console.log(c.name,rows.length,'selectors',reads.filter(x=>x.contract===c.name&&!x.error).length,'getter results');
}
await save('inspection/selector-catalog.json',catalog);
await save('inspection/onchain-reads.json',reads);
await save('inspection/contract-links.json',links);
// A bounded real interaction sample, not a full historical index.
const sampleHashes=new Set();
for(const c of contracts){
 const html=await readFile(path.join(root,`upstream/contracts/${c.name}/proxy-explorer.html`),'utf8');
 const hashes=[...html.matchAll(/href=['"]\/tx\/(0x[0-9a-fA-F]{64})['"]/g)].map(m=>m[1]);
 hashes.slice(0,2).forEach(h=>sampleHashes.add(h));
}
const logs=rpc('eth_getLogs',[{address:contracts.map(c=>c.address),fromBlock:'0x'+(BigInt(block)-49n).toString(16),toBlock:block}]);
await save('inspection/recent-logs.json',logs);
logs.slice(0,6).forEach(l=>sampleHashes.add(l.transactionHash));
const txs=[];
for(const hash of sampleHashes){
 try{txs.push({transaction:rpc('eth_getTransactionByHash',[hash]),receipt:rpc('eth_getTransactionReceipt',[hash])});}catch(e){txs.push({hash,error:e.message});}
}
await save('inspection/transaction-samples.json',txs);
console.log('Archived',txs.length,'transaction samples and',logs.length,'recent logs');
