// Optional deterministic scenario: every point is an actual operator publication.
const base='http://127.0.0.1:4173';
for(const [market,start]of [[1,82213.35],[2,3000]]){
 for(let i=0;i<28;i++){
  const factor=i===27?1:1+.0008*Math.sin(i*.43)+.0003*Math.cos(i*.81),amount=(start*factor).toFixed(8);
  const r=await fetch(base+'/api/action',{method:'POST',headers:{'Content-Type':'application/json','X-Lab-Request':'1'},body:JSON.stringify({action:'price',actor:2,market,amount})});if(!r.ok)throw Error(await r.text());
 }
}
console.log('Published 56 deterministic scenario observations on the local chain.');
