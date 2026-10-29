import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { readSettings,saveSettings } from './providers/litellm-settings.ts';
async function main(){
 if(!process.stdin.isTTY)throw new Error('Run pnpm setup:litellm in an interactive terminal. For scripts, set LITELLM_* environment variables instead.');
 const root=fileURLToPath(new URL('../',import.meta.url));let previous;
 try{previous=readSettings(root);}catch{previous={};}
 let hidden=false;const output=new Writable({write(chunk,_encoding,callback){if(!hidden)process.stdout.write(chunk);callback();}});
 const rl=createInterface({input:process.stdin,output,terminal:true});
 rl.on('SIGINT',()=>{rl.close();process.exitCode=130;});
 async function ask(label:string,fallback=''){const value=(await rl.question(label+(fallback?` [${fallback}]`:'')+': ')).trim();return value||fallback;}
 try{
  console.log('Forecast Ledger · LiteLLM setup\nSaved locally; no model calls are made during setup.');
  const base=await ask('Gateway URL (root, /v1, or completion URL)',previous.LITELLM_BASE_URL||'');
  process.stdout.write('Virtual key (hidden; Enter keeps existing key): ');hidden=true;
  let key:string;try{key=(await rl.question('')).trim()||previous.LITELLM_API_KEY||'';}finally{hidden=false;process.stdout.write('\n');}
  const model=await ask('Model alias configured in your gateway',previous.LITELLM_MODEL||'');
  const api=await ask('API: chat or responses',previous.LITELLM_API||(base.replace(/\/+$/,'').endsWith('/responses')?'responses':'chat'));
  console.log('Choose web only if this model route supports native web search. Otherwise choose evidence and supply dated source files.');
  const search=await ask('Research mode: web or evidence',previous.LITELLM_SEARCH||'web');
  const directory=search==='evidence'?await ask('Evidence directory',previous.LITELLM_EVIDENCE_DIR||'evidence'):undefined;
  saveSettings(root,{LITELLM_BASE_URL:base,LITELLM_API_KEY:key,LITELLM_MODEL:model,LITELLM_API:api,LITELLM_SEARCH:search,...(directory?{LITELLM_EVIDENCE_DIR:directory}:{})});
  console.log('\nSaved .ledger/litellm.json (excluded from Git, owner-only file permissions).\nEnvironment variables override saved settings.\n\nNext: pnpm research doctor\nThen: pnpm research run --contest 2026-TX-S --limit 1\nAll contests: pnpm research run --all --limit 868');
 }finally{rl.close();}
}
main().catch(e=>{console.error(e instanceof Error?e.message:'Setup failed.');process.exitCode=1;});
