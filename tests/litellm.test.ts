import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtempSync,writeFileSync,readFileSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { liteConfig,liteCompletion,evidencePacket } from '../scripts/providers/litellm.ts';
import { contests,FORECAST_DEADLINE } from '../lib/national.ts';
const env={LITELLM_BASE_URL:'https://gateway.example/v1',LITELLM_API_KEY:'test-secret-do-not-log'};
const config=(api='responses',search='web')=>liteConfig('research-alias',api,search,30,env);
const mock=(data:unknown,status=200)=>(async()=>new Response(JSON.stringify(data),{status})) as typeof fetch;
const response=(text:string)=>({status:'completed',output:[{type:'web_search_call',status:'completed'},{type:'message',content:[{type:'output_text',text}]}],usage:{input_tokens:10,output_tokens:20,total_tokens:30}});
test('LiteLLM URL normalization, explicit research mode and credential transport',async()=>{
 assert.equal(config().url,'https://gateway.example/v1/responses');assert.equal(config('chat').url,'https://gateway.example/v1/chat/completions');
 for(const base of ['http://remote.example','https://user:pass@example.org','https://example.org/?key=x'])assert.throws(()=>liteConfig('alias','chat','web',30,{...env,LITELLM_BASE_URL:base}));
 assert.throws(()=>liteConfig('alias','chat','',30,env));assert.throws(()=>liteConfig('','chat','web',30,env));
 await liteCompletion(config(),'Research',undefined,(async(url,init)=>{assert.equal(url,config().url);assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer '+env.LITELLM_API_KEY);assert.equal(init?.redirect,'error');const b=JSON.parse(init?.body as string);assert.equal(b.model,'research-alias');assert.deepEqual(b.tools,[{type:'web_search_preview'}]);assert.ok(!JSON.stringify(b).includes(env.LITELLM_API_KEY));return new Response(JSON.stringify(response('{"abstain":true}')));}) as typeof fetch);
});
test('Responses extracts forecast and usage, rejects missing search and unfinished generation',async()=>{
 const result=await liteCompletion(config(),'Research',undefined,mock(response('{"abstain":true}')));assert.equal(result.text,'{"abstain":true}');assert.equal(result.usage.total_tokens,30);
 await assert.rejects(liteCompletion(config(),'Research',undefined,mock({status:'completed',output:[]})),/no completed web search/);
 await assert.rejects(liteCompletion(config(),'Research',undefined,mock({...response('{}'),status:'incomplete'})),/incomplete/);
});
test('chat completion uses search options and rejects unexecuted tools',async()=>{
 const good={choices:[{finish_reason:'stop',message:{content:'{}'}}]};
 await liteCompletion(config('chat'),'Research',undefined,(async(_url,init)=>{assert.deepEqual(JSON.parse(init?.body as string).web_search_options,{});return new Response(JSON.stringify(good));}) as typeof fetch);
 await assert.rejects(liteCompletion(config('chat'),'Research',undefined,mock({choices:[{finish_reason:'tool_calls',message:{tool_calls:[{}]}}]})),/unexecuted tool/);
});
test('provider failures never log bodies or echoed secrets; no implicit retries',async()=>{
 await assert.rejects(liteCompletion(config(),'Research',undefined,mock({error:env.LITELLM_API_KEY},401)),e=>e instanceof Error&&e.message.includes('401')&&!e.message.includes(env.LITELLM_API_KEY));
 await assert.rejects(liteCompletion(config(),'Research',undefined,mock(response(env.LITELLM_API_KEY))),/credential material/);
 let calls=0;await assert.rejects(liteCompletion(config(),'Research',undefined,(async()=>{calls++;throw new Error(env.LITELLM_API_KEY);}) as typeof fetch),e=>e instanceof Error&&!e.message.includes(env.LITELLM_API_KEY));assert.equal(calls,1);
});
test('dated source packets provide evidence without requesting browsing',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ledger-evidence-'));try{
 const file=join(dir,'2026-TX-S.json');writeFileSync(file,JSON.stringify({contestId:'2026-TX-S',sources:[{title:'Source title',url:'https://example.org',text:'A sufficiently long source extract containing facts and dates.',retrievedAt:'2026-10-01T00:00:00Z'}]}));
 const packet=evidencePacket(dir,'2026-TX-S',new Date('2026-10-28'));assert.equal(packet.urls[0],'https://example.org');assert.equal(packet.sha256.length,64);
 await liteCompletion(config('chat','evidence'),'Web research is required; if you cannot access current evidence',packet,(async(_u,init)=>{const b=JSON.parse(init?.body as string);assert.equal(b.web_search_options,undefined);assert.match(b.messages[1].content,/supplied dated source packet/);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{}'}}]}));}) as typeof fetch);
 await assert.rejects(liteCompletion(config('chat','evidence'),'Research'),/packet is required/);
 assert.throws(()=>evidencePacket(dir,'2026-TX-S',new Date('2026-09-01')),/retrievedAt/);
 }finally{rmSync(dir,{recursive:true,force:true});}
});
test('CLI calls a mock LiteLLM gateway, saves usage and resumes without spending again',async t=>{
 if(Date.now()>=Date.parse(FORECAST_DEADLINE)){t.skip('Live research locked after cutoff.');return;}
 const dir=mkdtempSync(join(tmpdir(),'ledger-lite-')),c=contests[0];let calls=0;
 const proposal={contestId:c.id,probabilities:Object.fromEntries(c.options.map(o=>[o.name,1/c.options.length])),method:'Mock gateway',rationale:'A test-only fixture to verify API integration and resume handling.',evidence:[{title:'Test evidence',url:'https://example.org'}]};
 const server=createServer(async(req,res)=>{calls++;let body='';for await(const chunk of req)body+=chunk;assert.equal(req.url,'/v1/responses');assert.equal(req.headers.authorization,'Bearer '+env.LITELLM_API_KEY);assert.equal(JSON.parse(body).model,'test-alias');res.setHeader('Content-Type','application/json');res.end(JSON.stringify(response(JSON.stringify(proposal))));});
 await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));const address=server.address() as {port:number};
 try{const args=['--experimental-strip-types','scripts/research.ts','run','--contest',c.id,'--provider','litellm','--search','web','--limit','1','--out',dir];const options={env:{...process.env,LITELLM_BASE_URL:`http://127.0.0.1:${address.port}`,LITELLM_API_KEY:env.LITELLM_API_KEY,LITELLM_MODEL:'test-alias'}};
 await promisify(execFile)(process.execPath,args,options);await promisify(execFile)(process.execPath,args,options);assert.equal(calls,1);const job=JSON.parse(readFileSync(join(dir,'jobs',c.id+'.json'),'utf8'));assert.equal(job.usage.total_tokens,30);assert.equal(job.model,'test-alias');assert.equal(job.status,'needs-review');assert.ok(!JSON.stringify(job).includes(env.LITELLM_API_KEY));
 }finally{await new Promise<void>((r,reject)=>server.close(e=>e?reject(e):r()));rmSync(dir,{recursive:true,force:true});}
});
