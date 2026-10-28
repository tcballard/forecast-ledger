import { getDb } from '@/db';
import { nationalForecasts,nationalOutcomes } from '@/db/schema';
import { FORECAST_DEADLINE,validateNational,validateOutcome } from './national';
export async function append(request:Request,kind:'forecast'|'outcome'){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'Foreign origin rejected.'},{status:403});
 const locked=Date.now()>=Date.parse(FORECAST_DEADLINE);if(kind==='forecast'&&locked||kind==='outcome'&&!locked)return Response.json({error:kind==='forecast'?'Forecasts are locked.':'Record certified results only after the forecast cutoff.'},{status:409});
 let value;try{const raw=await request.text();if(raw.length>60000)throw new Error('Maximum 60KB per record.');value=(kind==='forecast'?validateNational:validateOutcome)(JSON.parse(raw));}catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid record.'},{status:400});}
 const record={...value,id:crypto.randomUUID(),createdAt:new Date().toISOString()};try{await getDb().insert(kind==='forecast'?nationalForecasts:nationalOutcomes).values({id:record.id,contestId:record.contestId,createdAt:record.createdAt,payload:JSON.stringify(record)});return Response.json({record},{status:201});}catch{return Response.json({error:'Save failed; keep your draft and retry.'},{status:503});}
}
