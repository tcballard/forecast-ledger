import { createServer } from 'node:http';
import { readFileSync,existsSync } from 'node:fs';
import { resolve,extname,join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openStore } from './local-store.ts';
const root=fileURLToPath(new URL('../',import.meta.url)),assets=resolve(root,'dist-local');
if(!existsSync(join(assets,'index.html')))throw new Error('Run npm run build:local first.');
const port=Number(process.env.PORT||4174);if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('PORT must be 1024–65535.');
const store=openStore(process.env.LEDGER_DB||resolve(root,'.ledger/forecasts.sqlite'));
const types:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.json':'application/json'};
const server=createServer(async(req,res)=>{
 res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Cache-Control','no-store');
 const reply=(code:number,body:unknown)=>{res.writeHead(code,{'Content-Type':'application/json'});res.end(JSON.stringify(body));};
 // Bind loopback and reject hostile Hosts / origins to prevent DNS rebinding and cross-site writes.
 if(!['127.0.0.1:'+port,'localhost:'+port].includes(req.headers.host||''))return reply(403,{error:'Local access only.'});
 const origin=req.headers.origin;if(origin&&!['http://localhost:'+port,'http://127.0.0.1:'+port].includes(origin))return reply(403,{error:'Foreign origin rejected.'});
 const pathname=new URL(req.url||'/','http://127.0.0.1').pathname;
 if(pathname==='/api/national'&&req.method==='GET')return reply(200,store.read());
 if(['/api/national/forecasts','/api/national/outcomes'].includes(pathname)&&req.method==='POST'){
  try{let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>60000){reply(413,{error:'Maximum 60KB per record.'});return;}}return reply(201,{record:store.append(JSON.parse(raw),pathname.endsWith('forecasts')?'forecast':'outcome')});}catch(e){return reply(400,{error:e instanceof Error?e.message:'Invalid request.'});}
 }
 if(req.method!=='GET')return reply(405,{error:'Method not allowed.'});
 if(pathname.startsWith('/api/'))return reply(404,{error:'Unknown endpoint.'});
 let path;try{path=resolve(assets,'.'+decodeURIComponent(pathname));}catch{return reply(400,{error:'Invalid path.'});}
 if(!path.startsWith(assets+'/')&&path!==assets)return reply(403,{error:'Invalid path.'});
 if(path===assets||pathname==='/')path=join(assets,'index.html');
 try{const data=readFileSync(path);res.writeHead(200,{'Content-Type':types[extname(path)]||'application/octet-stream'});res.end(data);}catch{return reply(404,{error:'Not found.'});}
});
server.listen(port,'127.0.0.1',()=>console.log(`Forecast Ledger → http://localhost:${port}\nDatabase: ${process.env.LEDGER_DB||'.ledger/forecasts.sqlite'}\nCtrl+C to stop.`));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{store.close();process.exit(0);}));
