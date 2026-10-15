import os,subprocess,pathlib,shutil,re,json,time,sqlite3,platform,uuid
src=pathlib.Path(__file__).resolve().parents[2]; dst=pathlib.Path('/tmp/robinpaper-extreme-qa-'+(time.strftime('%Y%m%d-%H%M%S')+'-'+uuid.uuid4().hex[:6]));dst.mkdir(mode=0o700)
for name in subprocess.check_output(['git','ls-files','-z'],cwd=src).decode().split('\0'):
 if not name:continue
 p=dst/name;p.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(src/name,p)
for folder in ['node_modules','protocol/node_modules']:
 p=dst/folder
 if not p.exists():p.symlink_to(src/folder,target_is_directory=True)
runtime=dst/'demo/.runtime';runtime.mkdir(mode=0o700)
for p in (src/'demo/.runtime').iterdir():
 if p.is_file() and not any(t in p.name for t in ['app.sqlite3','service.local','redis.local']):
  shutil.copy2(p,runtime/p.name)
with sqlite3.connect(src/'demo/.runtime/app.sqlite3') as a,sqlite3.connect(runtime/'app.sqlite3') as b:a.backup(b)
(runtime/'network.local.json').write_text(json.dumps({'shared':False,'lanHost':None}));(runtime/'lan-control.local.json').write_text('{"feed":false}')
offset=int(os.environ.get('QA_PORT_OFFSET','10000'));assert offset in (10000,20000);ports={str(p):str(p+offset) for p in [4173,4174,9545,9546,6387]}
(runtime/'qa-isolation.local.json').write_text(json.dumps({'publicPort':ports['4173'],'rpcPort':ports['9545'],'sourceRevision':subprocess.check_output(['git','rev-parse','HEAD'],cwd=src).decode().strip()}))
for p in (dst/'demo').rglob('*'):
 if not p.is_file() or '.runtime' in p.parts or p.suffix not in ['.mjs','.rs','.js','.json']:continue
 s=p.read_text();s=re.sub(r'\b(4173|4174|9545|9546|6387)\b',lambda m:ports[m[0]],s);s=s.replace('0.0.0.0:'+ports['4173'],'127.0.0.1:'+ports['4173']);p.write_text(s)
proxy=dst/'demo/scripts/fork-cache.mjs';body=proxy.read_text();body=body.replace('   // CREATE succeeded', "   try{for(const address of JSON.parse(await readFile(runtime+'/qa-zero-accounts.local.json','utf8')))created.add(address.toLowerCase());}catch{}\n   // CREATE succeeded");proxy.write_text(body)
# APFS clone keeps dependency compilation independent without rewriting the live binary.
if platform.system()=='Darwin':subprocess.run(['cp','-cR',str(src/'demo/backend/target'),str(dst/'demo/backend/target')],check=True)
else:shutil.copytree(src/'demo/backend/target',dst/'demo/backend/target')
pathlib.Path('/tmp/robinpaper-qa-path').write_text(str(dst));print(dst)
