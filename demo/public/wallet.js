// EIP-1193 connector. Transactions are encoded by the ABI service, signed by the
// user's wallet, then broadcast to the shared fork. No private keys enter the UI.
export function walletClient({provider,base=location.origin,onAccount=()=>{},onStatus=()=>{}}){
 let address;
 const rpc=async(method,params=[])=>{const r=await fetch(base+'/rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(15000)});const j=await r.json();if(!r.ok||j.error)throw Error(j.error?.message||j.error||'RPC unavailable');return j.result;};
 async function connect(){
  if(!provider)throw Error('Open this page in a browser with MetaMask or another injected EVM wallet; import the test key supplied by the host.');
  const accounts=await provider.request({method:'eth_requestAccounts'});if(!accounts.length)throw Error('No wallet account selected');
  try{await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x7a69'}]});}
  catch(e){if(e.code!==4902)throw e;await provider.request({method:'wallet_addEthereumChain',params:[{chainId:'0x7a69',chainName:'Robinpaper LAN fork',nativeCurrency:{name:'Test Ether',symbol:'ETH',decimals:18},rpcUrls:[base+'/rpc']}]});await provider.request({method:'wallet_switchEthereumChain',params:[{chainId:'0x7a69'}]});}
  if(await provider.request({method:'eth_chainId'})!=='0x7a69')throw Error('Select Robinpaper fork chain 31337');
  // Chain IDs alone cannot distinguish two local forks: compare the exact head hash.
  const head=await rpc('eth_getBlockByNumber',['latest',false]);const walletHead=await provider.request({method:'eth_getBlockByNumber',params:[head.number,false]});if(walletHead?.hash!==head.hash)throw Error('Wallet is on another 31337 network. Set its RPC URL to '+base+'/rpc and reconnect.');
  address=accounts[0];onAccount(address);return address;
 }
 async function receipt(hash){const end=Date.now()+60000;while(Date.now()<end){const r=await rpc('eth_getTransactionReceipt',[hash]);if(r){if(BigInt(r.status)!==1n)throw Error('On-chain transaction reverted: '+hash);return r;}await new Promise(r=>setTimeout(r,500));}throw Error('Transaction submitted but confirmation timed out: '+hash);}
 async function action(action,args={}){
  if(!address)await connect();
  const current=await provider.request({method:'eth_accounts'});if(current[0]?.toLowerCase()!==address.toLowerCase())throw Error('Wallet account changed; reconnect.');
  async function prepare(payload){const r=await fetch(base+'/api/prepare',{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1'},body:JSON.stringify({...payload,from:address}),signal:AbortSignal.timeout(15000)}),plan=await r.json();if(!r.ok||plan.error)throw Error(plan.error||'Cannot prepare transaction');return plan;}
  let plan=await prepare({...args,action});
  if(plan.typedOrder){onStatus('Sign the scoped session order in your wallet');const signature=await provider.request({method:'eth_signTypedData_v4',params:[address,JSON.stringify(plan.typedOrder)]});plan=await prepare({action:'signedRequest',order:plan.typedOrder.message,signature});}
  let confirmed;
  for(const [i,t]of plan.transactions.entries()){
   if(await provider.request({method:'eth_chainId'})!=='0x7a69')throw Error('Wallet network changed; reconnect.');
   // Estimate each step after the previous receipt: approval must land before deposit.
   const estimated=BigInt(await rpc('eth_estimateGas',[t]));t.gas='0x'+(estimated+estimated/5n+10000n).toString(16);
   onStatus(`Confirm in your wallet (${i+1}/${plan.transactions.length})`);
   const hash=await provider.request({method:'eth_sendTransaction',params:[t]});confirmed=await receipt(hash);
   onStatus('Confirmed on shared fork · '+hash.slice(0,10));
  }
  return {hash:confirmed?.transactionHash,result:plan.result,queued:['open','close','closeAll'].includes(action)};
 }
 provider?.on?.('accountsChanged',()=>{address=undefined;onAccount(null);});provider?.on?.('chainChanged',()=>{address=undefined;onAccount(null);});
 return {connect,action,rpc,get address(){return address;}};
}
