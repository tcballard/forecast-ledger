import { readSettings,checkGateway } from './providers/litellm-settings.ts';
import { liteConfig,liteCompletion,evidencePacket } from './providers/litellm.ts';
import { readFileSync,writeFileSync,mkdirSync,existsSync,renameSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { contests,category,researchPrompt,validateNational,latestByContest,FORECAST_DEADLINE } from '../lib/national.ts';
import { openStore } from './local-store.ts';
const args=process.argv.slice(2),command=args[0],root=fileURLToPath(new URL('../',import.meta.url));
let settings:ReturnType<typeof readSettings>={};
function option(key:string,fallback=''){const i=args.indexOf('--'+key);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw new Error('Missing value for --'+key);return args[i+1];}
const out=resolve(option('out','research-output')),database=process.env.LEDGER_DB||resolve(root,'.ledger/forecasts.sqlite');
function selected(){const id=option('contest'),state=option('state'),office=option('office');if(!id&&!state&&!office&&!args.includes('--all'))throw new Error('Select --all, --contest ID, --state XX, or --office House|Senate|Governor|Statewide|Measures.');const cs=contests.filter(c=>(!id||c.id===id)&&(!state||c.state===state)&&(!office||category(c)===office));if(!cs.length)throw new Error('No contests match.');return cs;}
function atomic(path:string,value:unknown){writeFileSync(path+'.tmp',JSON.stringify(value,null,2)+'\n');renameSync(path+'.tmp',path);}
function runModel(prompt:string):Promise<string>{return new Promise((resolvePromise,reject)=>{
 const provider=option('provider','litellm');let program:string,argv:string[];
 if(provider==='codex'){program='codex';argv=['exec','--sandbox','read-only','-'];const model=option('model');if(model)argv.splice(argv.length-1,0,'--model',model);}
 else if(provider==='command'){program=option('executable');if(!program)throw new Error('--provider command requires --executable PATH');const parsed=JSON.parse(option('args','[]'));if(!Array.isArray(parsed)||parsed.some(x=>typeof x!=='string'))throw new Error('--args must be a JSON array of strings.');argv=parsed;}
 else throw new Error('Choose --provider codex or --provider command.');
 const seconds=Number(option('timeout','300'));if(!Number.isFinite(seconds)||seconds<1||seconds>3600)throw new Error('--timeout must be 1–3600 seconds.');
 const child=spawn(program,argv,{cwd:root,stdio:['pipe','pipe','pipe'],shell:false});let stdout='',stderr='';const timer=setTimeout(()=>{child.kill('SIGKILL');reject(new Error('Provider timed out.'));},seconds*1000);
 child.on('error',e=>{clearTimeout(timer);reject(e);});child.stdout.on('data',d=>{stdout+=d;if(stdout.length>1000000){child.kill('SIGKILL');reject(new Error('Provider output exceeded 1MB.'));}});child.stderr.on('data',d=>{stderr=(stderr+d).slice(-10000);});child.on('close',code=>{clearTimeout(timer);code===0?resolvePromise(stdout):reject(new Error(`Provider exited ${code}: ${stderr.slice(-1500)}`));});child.stdin.on('error',()=>{});child.stdin.end(prompt);
 });}
async function main(){
 if(command==='doctor'){const configured=readSettings(root);const result=await checkGateway(configured);if(!result.available)throw new Error('Configured model was not listed. Available aliases: '+JSON.stringify(result.models.slice(0,20)));console.log('Gateway authentication and model listing succeeded. No model call was made.\nRun one contest next to verify generation and research support.');return;}
 if(command==='briefs'){const cs=selected();mkdirSync(join(out,'briefs'),{recursive:true});for(const c of cs)writeFileSync(join(out,'briefs',c.id+'.txt'),researchPrompt(c));console.log(`Wrote ${cs.length} research briefs to ${join(out,'briefs')}. No model calls made.`);return;}
 if(command==='run'){
  if(Date.now()>=Date.parse(FORECAST_DEADLINE))throw new Error('The forecast cutoff has passed; new research runs are locked.');
  const cs=selected(),limit=Number(option('limit','10'));
  const provider=option('provider','litellm');
  if(provider==='litellm')settings=readSettings(root);
  const model=option('model',settings.LITELLM_MODEL||'');
  const evidenceDir=option('evidence-dir',settings.LITELLM_EVIDENCE_DIR||'');
  const searchMode=option('search',evidenceDir?'evidence':settings.LITELLM_SEARCH||'');
  const lite=provider==='litellm'?liteConfig(model,option('api',settings.LITELLM_API||'chat'),searchMode,Number(option('timeout','300')),settings):undefined;
  if(lite?.search==='evidence'&&!evidenceDir)throw new Error('Set an evidence directory in setup or pass --evidence-dir.');if(!Number.isInteger(limit)||limit<1||limit>contests.length)throw new Error(`--limit must be 1–${contests.length}.`);
  mkdirSync(join(out,'proposals'),{recursive:true});mkdirSync(join(out,'jobs'),{recursive:true});let calls=0,success=0,failed=0,skipped=0;
  for(const c of cs){
   const path=join(out,'proposals',c.id+'.json'),jobpath=join(out,'jobs',c.id+'.json');
   if(existsSync(path)){try{const saved=validateNational(JSON.parse(readFileSync(path,'utf8')));if(saved.contestId===c.id){skipped++;continue;}}catch{}}
   if(calls>=limit)break;calls++;const prompt=researchPrompt(c),startedAt=new Date().toISOString(),job={contestId:c.id,startedAt,provider,model:lite?.model||option('model','provider default'),promptSha256:createHash('sha256').update(prompt).digest('hex')};
   atomic(jobpath,{...job,status:'running'});console.log(`[${calls}/${limit}] ${c.id}`);
   try{const packet=lite?.search==='evidence'?evidencePacket(resolve(root,evidenceDir),c.id):undefined;
   const result=lite?await liteCompletion(lite,prompt,packet):{text:await runModel(prompt)};
   const parsed=JSON.parse(result.text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));if(parsed.abstain)throw new Error('Provider abstained: '+String(parsed.reason||'No reason provided'));const proposal=validateNational(parsed);if(proposal.contestId!==c.id)throw new Error('Provider returned the wrong contest.');if(packet&&proposal.evidence.some(e=>!packet.urls.includes(e.url)))throw new Error('Forecast cited a URL outside its evidence packet.');atomic(path,proposal);atomic(jobpath,{...job,finishedAt:new Date().toISOString(),status:'needs-review',...('usage' in result?{usage:result.usage}:{}),...(lite?{api:lite.api,search:lite.search}:{}),...(packet?{evidenceSha256:packet.sha256}:{})});success++;}catch(e){failed++;atomic(jobpath,{...job,finishedAt:new Date().toISOString(),status:'failed',error:e instanceof Error?e.message:String(e)});console.error(`${c.id}: ${e instanceof Error?e.message:e}`);}
  }
  console.log(JSON.stringify({selected:cs.length,calls,success,failed,skipped,output:out,committed:0}));if(failed)process.exitCode=1;return;
 }
 if(command==='validate'||command==='import'){
  if(!args[1]||args[1].startsWith('--'))throw new Error('Pass a reviewed proposal JSON file.');const proposal=validateNational(JSON.parse(readFileSync(resolve(args[1]),'utf8')));
  if(command==='validate'){console.log(`Valid: ${proposal.contestId}; ${Object.keys(proposal.probabilities).length} options. Sources still require human verification.`);return;}
  const store=openStore(database);try{const record=store.append(proposal,'forecast');console.log(`Committed ${record.id} for ${record.contestId} at ${record.createdAt}`);}finally{store.close();}return;
 }
 if(command==='coverage'||command==='export'){
  const store=openStore(database);try{const ledger=store.read();if(command==='export'){console.log(JSON.stringify({...ledger,contests},null,2));return;}const latest=latestByContest(ledger.forecasts);console.log(JSON.stringify({contests:contests.length,complete:[...latest.values()].filter(f=>f.kind==='distribution').length,binary:[...latest.values()].filter(f=>f.kind==='binary').length,awaiting:contests.length-latest.size,byOffice:Object.fromEntries(['Senate','House','Governor','Statewide','Measures'].map(k=>[k,contests.filter(c=>category(c)===k).length])),database},null,2));}finally{store.close();}return;
 }
 console.log(`Forecast Ledger research CLI (LiteLLM is the default)\n\nSetup: pnpm setup:litellm\ndoctor\nrun --contest 2026-TX-S --limit 1\nrun --all --limit 868\nbriefs --all | --contest ID | --state XX | --office House\nrun --all --provider codex --limit 10 [--model NAME] [--timeout 300]\nrun --all --provider litellm --model ALIAS --search web --limit 10 [--api responses|chat]\nrun --all --provider litellm --model ALIAS --evidence-dir DIRECTORY --limit 10\nrun --all --provider command --executable PATH --args '["arg"]' --limit 10\nvalidate FILE.json\nimport FILE.json   # explicit local commitment after your review\ncoverage\nexport\n\nUse --out DIRECTORY for briefs, proposals and job logs. Runs resume existing valid proposals. Model calls may consume your provider allowance; no calls occur on app startup. CLI adapters use stdin/stdout; LiteLLM calls your configured API directly. No shell interpolation. --limit bounds calls per invocation. Runs never import automatically.`);
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
