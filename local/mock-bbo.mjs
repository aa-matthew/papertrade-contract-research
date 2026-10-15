// Test-only EVM runtime. Implements ABI-encoded BBO reads for asset indexes 0/1.
// This is a static fixture, not a live oracle or HyperCore emulator.
export const BBO='0x000000000000000000000000000000000000080e';
export function bboRuntime(prices){
 const code=[],fixups=[],labels={};
 const emit=(...b)=>code.push(...b);
 const pushWord=n=>{emit(0x7f,...Buffer.from(BigInt(n).toString(16).padStart(64,'0'),'hex'));};
 for(const asset of [0,1]){
  emit(0x60,0x00,0x35,0x60,asset,0x14,0x61,0x00,0x00,0x57);
  fixups.push({at:code.length-3,label:asset});
 }
 emit(0x60,0x00,0x60,0x00,0xfd);
 for(const asset of [0,1]){
  labels[asset]=code.length;emit(0x5b);
  const [bid,ask]=prices[asset];
  if(BigInt(bid)<=0n||BigInt(ask)<BigInt(bid))throw Error('Invalid fixture BBO');
  pushWord(bid);emit(0x60,0x00,0x52);pushWord(ask);emit(0x60,0x20,0x52,0x60,0x40,0x60,0x00,0xf3);
 }
 for(const {at,label} of fixups){code[at]=labels[label]>>8;code[at+1]=labels[label]&255;}
 return '0x'+Buffer.from(code).toString('hex');
}
