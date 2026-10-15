#!/usr/bin/env python3
"""Read-only archive of official Papertrade docs, frontend assets and chain code."""
import concurrent.futures, datetime, hashlib, html, json, os, pathlib, re, subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
RPC = os.environ.get('PAPERTRADE_RPC_URL', 'https://rpc.hyperliquid.xyz/evm')
SLOTS = {
    'implementation': '0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc',
    'admin': '0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103',
    'beacon': '0xa3f0ad74e5423aebfd80d3ef4346578335a9a72aeaee59ff6cb3582b35133d50',
}

def fetch(url, data=None):
    args = ['curl', '-sSL', '--max-time', '35', '--retry', '1', url]
    if data is not None:
        args += ['-H', 'Content-Type: application/json', '--data-binary', json.dumps(data)]
    return subprocess.check_output(args)

def save(path, value):
    path = ROOT / path
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(value if isinstance(value, bytes) else (json.dumps(value, indent=2)+'\n').encode())

def rpc(method, params):
    out = json.loads(fetch(RPC, {'jsonrpc':'2.0', 'id':1, 'method':method, 'params':params}))
    if 'error' in out:
        raise RuntimeError(str(out['error']))
    return out['result']

def archive_contract(item, block):
    name, address = item
    base = f'upstream/contracts/{name}'
    result = {'name':name, 'address':address, 'requestedBlock':block, 'stateConsistency':'live reads; public RPC may ignore historical state tags', 'slots':{}}
    code = rpc('eth_getCode', [address, block])
    save(f'{base}/runtime.hex', (code+'\n').encode())
    result['runtimeBytes'] = (len(code)-2)//2
    for label, slot in SLOTS.items():
        try:
            value = rpc('eth_getStorageAt', [address, slot, block])
            result['slots'][label] = {'slot':slot,'value':value,'address': '0x'+value[-40:] if int(value,16) else None}
        except Exception as e:
            result['slots'][label] = {'error':str(e)}
    addresses = [('proxy', address)]
    impl = result['slots'].get('implementation',{}).get('address')
    if impl:
        addresses.append(('implementation',impl))
    for label, addr in addresses:
        if label != 'proxy':
            save(f'{base}/{label}-runtime.hex', (rpc('eth_getCode',[addr,block])+'\n').encode())
        raw = fetch('https://hyperevmscan.io/address/'+addr)
        save(f'{base}/{label}-explorer.html',raw)
        s = raw.decode(errors='replace')
        extracted = {'address':addr,'explorer':'https://hyperevmscan.io/address/'+addr,'sourceStatus':'not-extracted'}
        abi = re.search(r'<pre[^>]*id=[\"\']js-copytextarea2[\"\'][^>]*>(.*?)</pre>',s,re.S)
        if abi:
            try:
                parsed=json.loads(html.unescape(re.sub('<[^>]+>','',abi[1])))
                save(f'{base}/{label}-abi.json',parsed)
                extracted['abiStatus']='explorer-published'
            except Exception as e: extracted['abiError']=str(e)
        match=re.search(r'var editor_contractJsonData = (\'.*?\')\s*\n',s,re.S)
        if match and match[1] != "'{}'":
            # This is a JS string, decoded as data; never execute downloaded code.
            quoted=match[1][1:-1]
            try:
                quoted=re.sub(r'\\x([0-9a-fA-F]{2})',lambda m:'\\u00'+m[1],quoted)
                decoded=json.loads('"'+quoted.replace('"','\\"').replace("\\'", "'")+'"')
                obj=json.loads(decoded)
                save(f'{base}/{label}-sources.json',obj)
                extracted['sourceStatus']='explorer-published'
            except Exception as e: extracted['sourceError']=str(e)
        if 'Contract: Unverified' in s: extracted['sourceStatus']='unverified-on-explorer'
        sourcify=json.loads(fetch(f'https://sourcify.dev/server/v2/contract/999/{addr}?fields=all'))
        save(f'{base}/{label}-sourcify.json',sourcify)
        extracted['sourcifyMatch']=sourcify.get('match')
        result[label]=extracted
    save(f'{base}/metadata.json',result)
    print(name, result['runtimeBytes'], impl, result.get('implementation',result.get('proxy',{})).get('sourceStatus'),flush=True)
    return result

def main():
    docs=(ROOT/'upstream/web/docs-app.js').read_text()
    entries = dict(re.findall(r'<li><strong>([^<]+)</strong>.*?href="https://hyperevmscan.io/address/(0x[a-fA-F0-9]{40})"',docs))
    if not entries: raise RuntimeError('No official addresses extracted')
    save('inspection/official-addresses.json',entries)
    block=rpc('eth_blockNumber',[])
    save('inspection/snapshot.json',{'chainId':rpc('eth_chainId',[]),'block':block,'blockNumber':int(block,16),'blockHeader':rpc('eth_getBlockByNumber',[block,False]),'capturedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'rpc':RPC})
    # Extract all authored docs bodies from the downloaded static bundle.
    pages=re.findall(r'"([^"\n]+/[^"\n]+)":\{title:`([^`]+)`,eyebrow:`([^`]+)`,(?:lead:`([^`]*)`,)?body:`(.*?)`\}',docs,re.S)
    for slug,title,eyebrow,lead,body in pages:
        save(f'upstream/docs/{slug}.html',(f'<!-- Source: https://docs.papertrade.xyz/#/{slug} -->\n<h1>{title}</h1>\n<p>{lead}</p>\n'+body).encode())
    print('docs pages:',len(pages), 'contracts:',len(entries), 'block:',int(block,16),flush=True)
    # Download only dependency paths explicitly published in captured JS assets.
    seen=set(); pending={os.environ.get('PAPERTRADE_FRONTEND_ENTRY','index-T2XgWeBr.js')}
    while pending:
        batch=sorted(pending-seen)
        if not batch: break
        seen.update(batch)
        def get_asset(name):
            raw=fetch('https://exchange.papertrade.xyz/assets/'+name)
            save('upstream/frontend/assets/'+name,raw)
            return name,raw.decode(errors='replace')
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            results=list(pool.map(get_asset,batch))
        pending=set()
        for name,s in results:
            for path in re.findall(r'["\'`]((?:\./|assets/)[a-zA-Z0-9_.-]+\.(?:js|css))["\'`]',s):
                pending.add(path.split('/')[-1])
        if len(seen)>400: raise RuntimeError('Asset safety bound exceeded')
    save('inspection/frontend-assets.json',sorted(seen))
    print('frontend assets:',len(seen),flush=True)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        results=list(pool.map(lambda item:archive_contract(item,block),entries.items()))
    save('inspection/contracts.json',results)
    hashes={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in (ROOT/'upstream').rglob('*') if p.is_file()}
    save('inspection/sha256.json',hashes)

if __name__=='__main__': main()
