import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parse } from 'acorn';
import { format } from 'prettier';
import { Interface } from 'ethers';

const root = path.resolve(import.meta.dirname, '..');
const out = path.join(root, 'inspection');
await mkdir(path.join(out, 'abi'), { recursive: true });
await mkdir(path.join(root, 'readable/frontend'), { recursive: true });
function literal(n) {
  if (!n) throw Error('missing');
  if (n.type === 'Literal') return n.value;
  if (n.type === 'TemplateLiteral' && n.expressions.length === 0) return n.quasis[0].value.cooked;
  if (n.type === 'ArrayExpression') return n.elements.map(literal);
  if (n.type === 'ObjectExpression') return Object.fromEntries(n.properties.map(p => {
    if(p.type !== 'Property' || p.computed || p.method) throw Error('dynamic property');
    return [p.key.name ?? literal(p.key), literal(p.value)];
  }));
  if (n.type === 'UnaryExpression' && n.operator === '!') return !literal(n.argument);
  if (n.type === 'UnaryExpression' && n.operator === '-') return -literal(n.argument);
  throw Error('dynamic expression');
}
function walk(node, visit) {
  if (!node || typeof node !== 'object') return;
  if (node.type) visit(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'start' || key === 'end') continue;
    if (Array.isArray(value)) value.forEach(x => walk(x, visit));
    else if (value && typeof value === 'object') walk(value, visit);
  }
}
const abis = [], typed = [], configs = [], routes = [], parseErrors = [];
for (const file of await readdir(path.join(root, 'upstream/frontend/assets'))) {
  if (!file.endsWith('.js')) continue;
  const source = await readFile(path.join(root, 'upstream/frontend/assets', file), 'utf8');
  let ast;
  try { ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' }); }
  catch(e) { parseErrors.push({file,error:e.message}); continue; }
  walk(ast, node => {
    if (node.type === 'ArrayExpression' && node.elements.length) {
      try {
        const value = literal(node);
        if (value.every(x => (typeof x === 'string' && /^(function|event|error|constructor|fallback|receive)\s*[ (]/.test(x)) || (x && typeof x === 'object' && ['function','event','error','constructor','fallback','receive'].includes(x.type)))) {
          const iface = new Interface(value);
          abis.push({file,start:node.start,end:node.end,abi:JSON.parse(iface.formatJson()),publishedForm:value,functions:iface.fragments.filter(x=>x.type==='function').map(x=>({signature:x.format('sighash'),selector:x.selector,stateMutability:x.stateMutability}))});
        }
      } catch {}
    }
    if (node.type === 'ObjectExpression') {
      try {
        const value = literal(node);
        if (value.RegisterSessionKey && value.OpenPosition) typed.push({file,start:node.start,value});
        if (value.environmentId && value.contracts && value.chainId) configs.push({file,start:node.start,value});
        if (value.exchange?.name && value.paperStaking?.name) typed.push({file,start:node.start,domains:value});
      } catch {}
    }
    if(node.type === 'Literal' || node.type === 'TemplateLiteral') {
      try {
        const value = literal(node);
        if(typeof value === 'string' && /^\/(?:api|intents|account|market|deployment|status|staking|house|paper|v1)/.test(value)) routes.push({file,start:node.start,value});
      } catch {}
    }
  });
  if (/typed-data|execution-|wire-|app-|funding-routes|queries-|account-/.test(file)) {
    await writeFile(path.join(root,'readable/frontend',file),await format(source,{parser:'babel'}));
  }
}
for(let i=0;i<abis.length;i++) {
  const a=abis[i]; a.id=`frontend-${i}`;
  await writeFile(path.join(out,'abi',`${a.id}.json`),JSON.stringify(a.abi,null,2)+'\n');
}
await writeFile(path.join(out,'frontend-abis.json'),JSON.stringify(abis,null,2)+'\n');
await writeFile(path.join(out,'typed-data.json'),JSON.stringify(typed,null,2)+'\n');
await writeFile(path.join(out,'frontend-config.json'),JSON.stringify(configs,null,2)+'\n');
await writeFile(path.join(out,'http-routes.json'),JSON.stringify(routes,null,2)+'\n');
await writeFile(path.join(out,'parse-errors.json'),JSON.stringify(parseErrors,null,2)+'\n');
console.log(JSON.stringify({abis:abis.length,typedData:typed.length,configs:configs.length,routes:routes.length,parseErrors},null,2));
// Parse every documentation object as static data, including empty-lead pages.
const docsSource=await readFile(path.join(root,'upstream/web/docs-app.js'),'utf8');
const docPages=[];
walk(parse(docsSource,{ecmaVersion:'latest',sourceType:'module'}),node=>{
 if(node.type!=='Property')return;
 try{
  const slug=node.key.name??literal(node.key),value=literal(node.value);
  if(typeof slug==='string'&&slug.includes('/')&&typeof value.title==='string'&&typeof value.body==='string')docPages.push({slug,...value});
 }catch{}
});
for(const page of docPages){
 const target=path.join(root,'upstream/docs',page.slug+'.html');await mkdir(path.dirname(target),{recursive:true});
 await writeFile(target,`<!-- Source: https://docs.papertrade.xyz/#/${page.slug} -->\n<h1>${page.title}</h1>\n<p>${page.lead??''}</p>\n${page.body}`);
}
await writeFile(path.join(out,'docs-index.json'),JSON.stringify(docPages.map(({body,...meta})=>meta),null,2)+'\n');
console.log('Documentation pages:',docPages.length);
