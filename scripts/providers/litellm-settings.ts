import { readFileSync,mkdirSync,writeFileSync,renameSync,rmSync } from 'node:fs';
import { dirname,join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { liteConfig } from './litellm.ts';
export const settingNames=['LITELLM_BASE_URL','LITELLM_API_KEY','LITELLM_MODEL','LITELLM_API','LITELLM_SEARCH','LITELLM_EVIDENCE_DIR'] as const;
export type Settings=Partial<Record<typeof settingNames[number],string>>;
export function settingsPath(root:string){return join(root,'.ledger','litellm.json');}
export function readSettings(root:string,env:Record<string,string|undefined>=process.env):Settings{
 let stored:Settings={};
 try{const raw=readFileSync(settingsPath(root),'utf8');if(Buffer.byteLength(raw)>16000)throw new Error('oversized');const parsed=JSON.parse(raw);if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))throw new Error('invalid');for(const key of settingNames){if(parsed[key]!==undefined&&typeof parsed[key]!=='string')throw new Error('invalid');if(parsed[key]!==undefined)stored[key]=parsed[key];}}
 catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw new Error('Invalid local LiteLLM settings. Run pnpm setup:litellm to replace them.');}
 for(const key of settingNames)if(env[key]!==undefined)stored[key]=env[key];return stored;
}
export function saveSettings(root:string,settings:Settings){
 for(const key of settingNames)if(settings[key]!==undefined&&(typeof settings[key]!=='string'||/[\r\n\0]/.test(settings[key]!)||settings[key]!.length>4000))throw new Error('Settings must be single-line values under 4,000 characters.');
 liteConfig(settings.LITELLM_MODEL||'',settings.LITELLM_API||'chat',settings.LITELLM_SEARCH||'',300,settings);
 if(settings.LITELLM_SEARCH==='evidence'&&!settings.LITELLM_EVIDENCE_DIR?.trim())throw new Error('Choose an evidence directory for evidence mode.');
 const path=settingsPath(root),tmp=path+'.'+randomUUID()+'.tmp';mkdirSync(dirname(path),{recursive:true,mode:0o700});
 try{writeFileSync(tmp,JSON.stringify(Object.fromEntries(settingNames.filter(k=>settings[k]!==undefined).map(k=>[k,settings[k]])),null,2)+'\n',{mode:0o600,flag:'wx'});renameSync(tmp,path);}finally{rmSync(tmp,{force:true});}return path;
}
export async function checkGateway(settings:Settings,fetcher:typeof fetch=fetch){
 const config=liteConfig(settings.LITELLM_MODEL||'',settings.LITELLM_API||'chat',settings.LITELLM_SEARCH||'web',30,settings);
 const url=config.url.replace(/\/(responses|chat\/completions)$/,'/models');let response:Response;
 try{response=await fetcher(url,{headers:{Authorization:`Bearer ${config.key}`},redirect:'error',signal:AbortSignal.timeout(30000)});}catch{throw new Error('Could not reach LiteLLM model listing. Check URL, network and TLS.');}
 if(!response.ok){await response.body?.cancel();throw new Error(`LiteLLM model listing returned HTTP ${response.status}. Check URL and virtual-key access. No completion was requested.`);}
 const reader=response.body?.getReader();if(!reader)throw new Error('Empty model listing.');let raw='',size=0;
 try{const decoder=new TextDecoder();for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>1000000){await reader.cancel();throw new Error('oversized');}raw+=decoder.decode(value,{stream:true});}raw+=decoder.decode();}catch{throw new Error('Model listing exceeded its limit or timed out.');}
 let data;try{data=JSON.parse(raw);}catch{throw new Error('Gateway returned an invalid model listing.');}
 if(!Array.isArray(data?.data))throw new Error('Gateway model listing must contain a data array.');
 const models=data.data.flatMap((entry:unknown)=>entry&&typeof entry==='object'&&'id' in entry&&typeof entry.id==='string'&&entry.id.length<=200&&!entry.id.includes(config.key)?[entry.id]:[]) as string[];
 return {available:models.includes(config.model),models};
}
