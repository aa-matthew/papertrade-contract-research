import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { parseExpressionAt } from 'acorn';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const results=[];
for(const name of await readdir(path.join(root,'upstream/contracts'))){
 const folder=path.join(root,'upstream/contracts',name);
 let meta;try{meta=JSON.parse(await readFile(path.join(folder,'metadata.json'),'utf8'));}catch{continue;}
 for(const role of ['proxy','implementation']){
  let html;try{html=await readFile(path.join(folder,`${role}-explorer.html`),'utf8');}catch{continue;}
  const match=/var editor_contractJsonData\s*=\s*/.exec(html);
  if(!match)continue;
  try{
   const literal=parseExpressionAt(html,match.index+match[0].length,{ecmaVersion:'latest'});
   if(literal.type!=='Literal'||typeof literal.value!=='string')throw Error('Expected static data string');
   const input=JSON.parse(literal.value);
   if(!input.sources)continue;
   await writeFile(path.join(folder,`${role}-compiler-input.json`),JSON.stringify(input,null,2)+'\n');
   let count=0;
   for(const [source,value]of Object.entries(input.sources)){
    if(typeof value.content!=='string')continue;
    const base=path.join(root,'upstream/sources',name,role);
    const target=path.resolve(base,source);
    if(!target.startsWith(base+path.sep))throw Error('Unsafe source path');
    await mkdir(path.dirname(target),{recursive:true});await writeFile(target,value.content);count++;
   }
   meta[role].sourceStatus='explorer-published';delete meta[role].sourceError;
   results.push({contract:name,role,files:count,address:meta[role].address});
  }catch(e){results.push({contract:name,role,error:e.message});}
 }
 await writeFile(path.join(folder,'metadata.json'),JSON.stringify(meta,null,2)+'\n');
}
await writeFile(path.join(root,'inspection/source-extraction.json'),JSON.stringify(results,null,2)+'\n');
console.log(results);
