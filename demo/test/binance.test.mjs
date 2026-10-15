import test from 'node:test';
import assert from 'node:assert/strict';
import {validateQuotes} from '../scripts/binance-sim.mjs';
const now=1792090138000,rows=()=>[{symbol:'BTCUSDT',lastPrice:'82344.72000000',closeTime:now},{symbol:'ETHUSDT',lastPrice:'2450.31000000',closeTime:now-100}];
test('accepts fresh exact eight-decimal Binance spot quotes and maps market IDs',()=>{
 const q=validateQuotes(rows(),now);assert.equal(q[0].price,'82344.72000000');assert.deepEqual(q.map(x=>x.market),[1,2]);
});
test('rejects stale, future, incomplete and duplicate observations',()=>{
 for(const mutate of [r=>{r[0].closeTime-=10001;},r=>{r[0].closeTime+=2001;},r=>{r.pop();},r=>{r[1].symbol='BTCUSDT';}]){const r=rows();mutate(r);assert.throws(()=>validateQuotes(r,now));}
});
test('rejects nonpositive, malformed or overly precise prices without a synthetic fallback',()=>{
 for(const price of ['0','-1','NaN','Infinity','1e5','123.123456789']){const r=rows();r[0].lastPrice=price;assert.throws(()=>validateQuotes(r,now));}
});
