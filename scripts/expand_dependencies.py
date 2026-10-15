#!/usr/bin/env python3
"""Follow discovered getter links, proxy admins and literal code dependencies."""
import concurrent.futures, json, pathlib, re, subprocess
from collect import ROOT, archive_contract, rpc, save

contracts=json.loads((ROOT/'inspection/contracts.json').read_text())
block=json.loads((ROOT/'inspection/snapshot.json').read_text())['block']
seen={c['address'].lower() for c in contracts}
seen.update(c['slots'].get('implementation',{}).get('address') for c in contracts)
links=json.loads((ROOT/'inspection/contract-links.json').read_text())
known={
 '0xe79c91cc682f1bb401a9cab74c900470190f0f8f':'ProxyAdmin',
 '0x6b9e773128f453f5c2c60935ee2de2cbc5390a24':'CoreDepositWallet',
 '0xcd617f984158a4f5d287ddee0e8eb0fed204916d':'ExchangeLinkedLibrary',
}
discovered=[]
for depth in range(3):
 candidates={}
 for c in contracts:
  for label in ['admin','beacon']:
   a=c['slots'].get(label,{}).get('address')
   if a:candidates[a]=f'{c["name"]}.{label}'
  base=ROOT/f'upstream/contracts/{c["name"]}'
  codefile=base/('implementation-runtime.hex' if c['slots'].get('implementation',{}).get('address') else 'runtime.hex')
  dis=subprocess.check_output(['cast','disassemble',codefile.read_text().strip()],text=True)
  (base/'disassembly.txt').write_text(dis)
  for a in re.findall(r'PUSH20 (0x[0-9a-fA-F]{40})',dis):candidates[a.lower()]=f'{c["name"]}.PUSH20'
 for link in links:candidates[link['address']]=f'{link["from"]}.{link["getter"]}'
 for a,n in known.items():candidates[a]=n
 pending=[(a,origin) for a,origin in candidates.items() if a not in seen and int(a,16) and a!='0xffffffffffffffffffffffffffffffffffffffff']
 if not pending:break
 def check(item):
  a,origin=item
  try:return {'address':a,'discoveredFrom':origin,'runtimeBytes':(len(rpc('eth_getCode',[a,block]))-2)//2}
  except Exception as e:return {'address':a,'discoveredFrom':origin,'error':str(e)}
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:checks=list(pool.map(check,pending))
 discovered.extend(checks);seen.update(x['address'] for x in checks)
 jobs=[]
 for item in checks:
  if item.get('runtimeBytes',0)>0 and item['address']!='0x3333333333333333333333333333333333333333':
   a=item['address'];jobs.append((known.get(a,'Dependency_'+a[2:10]),a))
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:new=list(pool.map(lambda j:archive_contract(j,block),jobs))
 contracts.extend(new)
 for c in new:
  a=c['slots'].get('implementation',{}).get('address')
  if a:seen.add(a)
 save('inspection/contracts.json',contracts)
save('inspection/dependency-discovery.json',discovered)
print('Total archived address entries:',len(contracts))
