#!/usr/bin/env python3
"""Archive native-system boundary and proxy dependencies omitted by the docs list."""
import datetime, json
from collect import ROOT, rpc, archive_contract, save
contracts=json.loads((ROOT/'inspection/contracts.json').read_text())
anchor=json.loads((ROOT/'inspection/snapshot.json').read_text())
block=anchor['block']
official=json.loads((ROOT/'inspection/official-addresses.json').read_text())
def add(name,address):
 if not any(x['address'].lower()==address.lower() for x in contracts):contracts.append(archive_contract((name,address),block))
# Circle USDC uses a legacy proxy implementation slot, so obtain its explicit getter.
impl=rpc('eth_call',[{'to':official['USDC'],'data':'0x5c60da1b'},'latest'])
add('USDCImplementation','0x'+impl[-40:])
add('CoreWriterSystem','0x3333333333333333333333333333333333333333')
txs=json.loads((ROOT/'inspection/transaction-samples.json').read_text())
factory=official['DepositProxyFactory']
for item in txs:
 tx=item.get('transaction') or {}
 if (tx.get('to') or '').lower()==factory.lower() and tx.get('input','').startswith('0xcbd433f4'):
  user='0x'+tx['input'][-40:]
  result=rpc('eth_call',[{'to':factory,'data':'0xd600539a'+user[2:].rjust(64,'0')},'latest'])
  address='0x'+result[-40:]
  if int(address,16):
   add('SampleUserDepositProxy',address)
   save('inspection/sample-deposit-proxy.json',{'user':user,'address':address,'sourceTransaction':tx['hash'],'scope':'One representative deployed per-user proxy; not an enumeration of all user instances.'})
  break
reads=[]
for address in ['0x000000000000000000000000000000000000080e','0x0000000000000000000000000000000000000806','0x0000000000000000000000000000000000000807']:
 for asset in [0,1]:
  data='0x'+hex(asset)[2:].rjust(64,'0')
  item={'address':address,'asset':asset,'data':data,'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat()}
  try:item['raw']=rpc('eth_call',[{'to':address,'data':data},'latest'])
  except Exception as e:item['error']=str(e)
  reads.append(item)
save('inspection/hypercore-precompile-reads.json',reads)
proof={tag:rpc('eth_getCode',[official['Exchange'],tag]) for tag in ['0x0',block,'latest']}
save('inspection/rpc-history-check.json',{'requestedTags':list(proof),'sameExchangeRuntimeForGenesisAndLatest':proof['0x0']==proof['latest'],'conclusion':'Public RPC returns present code at genesis; state captures are live observations, not a coherent historical snapshot.','results':proof})
anchor['stateConsistency']='Collection anchor only. Public RPC ignores historical state tags. Individual calls span a capture window.'
save('inspection/snapshot.json',anchor)
for c in contracts:
 c['requestedBlock']=c.pop('block',c.get('requestedBlock',block))
 c['stateConsistency']='live reads; historical tag not honored by public RPC'
 save(f'upstream/contracts/{c["name"]}/metadata.json',c)
save('inspection/contracts.json',contracts)
