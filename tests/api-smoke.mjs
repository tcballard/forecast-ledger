// Run only against a development preview; this script never writes valid forecasts or outcomes.
import assert from 'node:assert/strict';
const base=process.argv[2];
if(!base||!['localhost','127.0.0.1','terminal.local'].includes(new URL(base).hostname))throw new Error('Pass the local preview origin.');
const get=await fetch(new URL('/api/ledger',base));assert.equal(get.status,200);
const initial=await get.json();assert.equal(initial.forecasts.filter(f=>f.id.startsWith('baseline-')).length,5);
for(const f of initial.forecasts){assert.ok(Array.isArray(f.evidence));assert.ok(f.probability>0&&f.probability<1);}
async function post(path,body,origin){return fetch(new URL(path,base),{method:'POST',headers:{'Content-Type':'application/json',...(origin?{Origin:origin}:{})},body:JSON.stringify(body)});}
let r=await post('/api/forecasts',{},'https://untrusted.example');assert.equal(r.status,403);
r=await post('/api/forecasts',{raceId:'2026-KS-S',probability:58,method:'Test',rationale:'This invalid proposal must never be committed.',evidence:[]});assert.equal(r.status,400);assert.match((await r.json()).error,/Probability/);
r=await post('/api/forecasts',{raceId:'2026-KS-S',probability:0.58,method:'Test',rationale:'This invalid proposal must never be committed.',evidence:[{title:'Unsafe source',url:'javascript:alert(1)'}]});assert.equal(r.status,400);
r=await post('/api/outcomes',{raceId:'2026-KS-S',won:1,source:'https://example.com/result'});assert.equal(r.status,409);
const after=await (await fetch(new URL('/api/ledger',base))).json();assert.equal(after.forecasts.length,initial.forecasts.length);assert.equal(after.outcomes.length,initial.outcomes.length);
console.log('API smoke passed: ledger retrieval; valid evidence shape; cross-origin rejection; invalid probability and unsafe source rejection; premature outcome rejection; no invalid writes.');
