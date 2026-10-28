import { getDb } from '@/db';
import { outcomes } from '@/db/schema';
import { races } from '@/lib/data';
import { isLocked, safeUrl } from '@/lib/engine';
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'This request must come from Forecast Ledger.'},{status:403});
 if(!isLocked())return Response.json({error:'Outcomes cannot be recorded before the forecast cutoff. Use the scenario explorer instead.'},{status:409});
 try{const raw=await request.text();if(raw.length>5000)throw new Error('Result is too large.');const v=JSON.parse(raw);
 if(!races.some(r=>r.id===v.raceId)||![0,1].includes(v.won)||!safeUrl(v.source))throw new Error('Choose a race, a binary outcome, and an HTTPS link to the certified result.');
 const record={id:crypto.randomUUID(),raceId:v.raceId,won:v.won,source:v.source,createdAt:new Date().toISOString()};
 await getDb().insert(outcomes).values(record);return Response.json({outcome:record},{status:201});
 }catch(e){return Response.json({error:e instanceof Error?e.message:'Could not record this outcome.'},{status:400});}
}
