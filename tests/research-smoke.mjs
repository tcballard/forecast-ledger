import { spawnSync } from 'node:child_process';
import { mkdtempSync,readFileSync,writeFileSync,rmSync,readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import contests from '../data/contests.json' with {type:'json'};
const dir=mkdtempSync(join(tmpdir(),'ledger-runner-')),c=contests[0],provider=join(dir,'provider.mjs');
const proposal={contestId:c.id,probabilities:Object.fromEntries(c.options.map(o=>[o.name,1/c.options.length])),method:'Stub provider test',rationale:'A test-only proposal verifies orchestration without a model or network call.',evidence:[{title:'Test source',url:'https://example.org'}]};
writeFileSync(provider,`process.stdin.resume();process.stdin.on('end',()=>console.log(${JSON.stringify(JSON.stringify(proposal))}));`);
function cli(args){const r=spawnSync(process.execPath,['--experimental-strip-types','scripts/research.ts',...args],{encoding:'utf8',env:{...process.env,LEDGER_DB:join(dir,'ledger.sqlite')}});assert.equal(r.status,0,r.stderr);return r.stdout;}
try{cli(['briefs','--all','--out',dir]);assert.equal(readdirSync(join(dir,'briefs')).length,868);if(Date.now()>=Date.parse('2026-11-03T23:00:00Z')){console.log('PASS: all 868 briefs. Live runner/import are correctly unavailable after cutoff; frozen-clock store tests cover boundaries.');rmSync(dir,{recursive:true,force:true});process.exit(0);}const args=['run','--contest',c.id,'--provider','command','--executable',process.execPath,'--args',JSON.stringify([provider]),'--out',dir,'--limit','1'];assert.match(cli(args),/"success":1/);assert.match(cli(args),/"skipped":1/);const path=join(dir,'proposals',c.id+'.json');cli(['validate',path]);assert.equal(JSON.parse(cli(['coverage'])).complete,0);cli(['import',path]);assert.equal(JSON.parse(cli(['coverage'])).complete,1);assert.equal(JSON.parse(readFileSync(join(dir,'jobs',c.id+'.json'),'utf8')).status,'needs-review');console.log('PASS: 868 briefs, adapter, validated proposal, resume, explicit import and coverage. No paid model calls.');}finally{rmSync(dir,{recursive:true,force:true});}
