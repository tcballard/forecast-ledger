import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../scripts/local-store.ts';
import { contests,FORECAST_DEADLINE } from '../lib/national.ts';
test('SQLite survives reopen, appends revisions, strips caller timestamps and locks both sides of cutoff',()=>{
 const dir=mkdtempSync(join(tmpdir(),'ledger-test-')),path=join(dir,'ledger.sqlite'),c=contests.find(c=>c.id==='2026-TX-S')!;
 const v={contestId:c.id,probabilities:Object.fromEntries(c.options.map(o=>[o.name,1/c.options.length])),method:'Test research',rationale:'A sufficiently long test rationale with supporting evidence.',evidence:[{title:'Test source',url:'https://example.org'}],createdAt:'1999-01-01'};
 let store=openStore(path);try{const before=new Date(Date.parse(FORECAST_DEADLINE)-1000),after=new Date(Date.parse(FORECAST_DEADLINE));const first=store.append(v,'forecast',before);assert.equal(first.createdAt,before.toISOString());store.append({...v,method:'Revised research'},'forecast',before);assert.throws(()=>store.append(v,'forecast',after));assert.throws(()=>store.append({contestId:c.id,winner:c.options[0].name,source:'https://example.org'},'outcome',before));store.append({contestId:c.id,winner:c.options[0].name,source:'https://example.org'},'outcome',after);store.close();store=openStore(path);assert.equal(store.read().forecasts.length,7);assert.equal(store.read().outcomes.length,1);assert.equal(store.read().forecasts[0].method,'Revised research');}finally{store.close();rmSync(dir,{recursive:true,force:true});}
});
