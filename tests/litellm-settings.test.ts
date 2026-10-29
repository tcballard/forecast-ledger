import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync,readFileSync,statSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSettings,saveSettings,checkGateway,settingsPath } from '../scripts/providers/litellm-settings.ts';
import { liteConfig } from '../scripts/providers/litellm.ts';
const settings={LITELLM_BASE_URL:'https://gateway.example/v1/chat/completions',LITELLM_API_KEY:'fake-private-test-key',LITELLM_MODEL:'my-alias',LITELLM_API:'chat',LITELLM_SEARCH:'web'};
test('local settings survive reload, stay private and allow environment overrides',()=>{
 const root=mkdtempSync(join(tmpdir(),'ledger-settings-'));try{
  assert.deepEqual(readSettings(root,{}),{});saveSettings(root,settings);assert.deepEqual(readSettings(root,{}),settings);
  assert.equal(readSettings(root,{LITELLM_MODEL:'override'}).LITELLM_MODEL,'override');
  if(process.platform!=='win32')assert.equal(statSync(settingsPath(root)).mode&0o777,0o600);
  assert.throws(()=>saveSettings(root,{...settings,LITELLM_SEARCH:'evidence'}),/evidence directory/);
  assert.throws(()=>saveSettings(root,{...settings,LITELLM_API_KEY:'bad\nkey'}),/single-line/);
  assert.equal(JSON.parse(readFileSync(settingsPath(root),'utf8')).LITELLM_MODEL,'my-alias');
 }finally{rmSync(root,{recursive:true,force:true});}
});
test('root, versioned and full completion endpoints normalize without duplication',()=>{
 for(const url of ['https://gateway.example','https://gateway.example/v1/','https://gateway.example/v1/chat/completions','https://gateway.example/v1/responses/'])assert.equal(liteConfig('alias','chat','web',30,{...settings,LITELLM_BASE_URL:url}).url,'https://gateway.example/v1/chat/completions');
 assert.equal(liteConfig('alias','responses','web',30,{...settings,LITELLM_BASE_URL:'https://gateway.example/gateway/v1/chat/completions'}).url,'https://gateway.example/gateway/v1/responses');
});
test('doctor checks only models, preserves bearer credentials and reports missing aliases',async()=>{
 const result=await checkGateway(settings,(async(url,init)=>{assert.equal(url,'https://gateway.example/v1/models');assert.equal(init?.method,undefined);assert.equal(init?.redirect,'error');assert.equal((init?.headers as Record<string,string>).Authorization,'Bearer '+settings.LITELLM_API_KEY);return Response.json({data:[{id:'my-alias'},{id:'other'}]});}) as typeof fetch);
 assert.equal(result.available,true);
 assert.equal((await checkGateway(settings,(async()=>Response.json({data:[{id:'other'}]})) as typeof fetch)).available,false);
 await assert.rejects(checkGateway(settings,(async()=>new Response(settings.LITELLM_API_KEY,{status:401})) as typeof fetch),e=>e instanceof Error&&e.message.includes('401')&&!e.message.includes(settings.LITELLM_API_KEY));
});
