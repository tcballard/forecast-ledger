import { get } from 'node:http';
import { spawn } from 'node:child_process';
import { mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import contests from '../data/contests.json' with {type:'json'};
const dir=mkdtempSync(join(tmpdir(),'ledger-http-')),port=18474;
const server=spawn(process.execPath,['--experimental-strip-types','scripts/local-server.ts'],{env:{...process.env,PORT:String(port),LEDGER_DB:join(dir,'test.sqlite')},stdio:['ignore','pipe','pipe']});
try{
 await new Promise((resolve,reject)=>{const t=setTimeout(()=>reject(new Error('Server did not start')),15000);server.stdout.on('data',d=>{if(String(d).includes('Forecast Ledger')){clearTimeout(t);resolve();}});server.once('error',reject);server.once('exit',code=>{clearTimeout(t);reject(new Error('Server exited '+code));});});
 const url='http://127.0.0.1:'+port;
 assert.equal((await fetch(url)).status,200);
 const first=await (await fetch(url+'/api/national')).json();assert.equal(first.forecasts.length,5);
 assert.equal((await fetch(url+'/api/national/forecasts',{method:'POST',headers:{Origin:'https://evil.example'},body:'{}'})).status,403);
 assert.equal(await new Promise((resolve,reject)=>{get(url+'/api/national',{headers:{host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);}).on('error',reject);}),403);
 assert.equal((await fetch(url+'/api/national/forecasts',{method:'POST',body:'{}'})).status,400);
 const c=contests[0],proposal={contestId:c.id,probabilities:Object.fromEntries(c.options.map(o=>[o.name,1/c.options.length])),method:'HTTP test only',rationale:'Test-only record that verifies the full local HTTP and SQLite path.',evidence:[{title:'Test evidence',url:'https://example.org'}]};
 const response=await fetch(url+'/api/national/forecasts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(proposal)});const locked=Date.now()>=Date.parse('2026-11-03T23:00:00Z');assert.equal(response.status,locked?400:201);const after=await (await fetch(url+'/api/national')).json();assert.equal(after.forecasts.length,locked?5:6);if(!locked)assert.equal(after.forecasts[0].contestId,c.id);
 assert.equal((await fetch(url+'/api/national/forecasts',{method:'POST',body:' '.repeat(61000)})).status,413);
 console.log('PASS: page, ledger, origin, host, validation, save/read and body limit (8 HTTP checks).');
}finally{server.kill('SIGTERM');await new Promise(r=>server.once('close',r));rmSync(dir,{recursive:true,force:true});}
