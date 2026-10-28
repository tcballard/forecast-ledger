import { getDb } from '@/db';
import { forecasts } from '@/db/schema';
import { isLocked, validateProposal } from '@/lib/engine';
export async function POST(request:Request){
 const origin=request.headers.get('origin');if(origin&&origin!==new URL(request.url).origin)return Response.json({error:'This request must come from Forecast Ledger.'},{status:403});
 if(isLocked())return Response.json({error:'Forecasts are locked. The experiment cutoff was 3 November 2026 at 23:00 UTC.'},{status:409});
 if(Number(request.headers.get('content-length')||0)>60000)return Response.json({error:'Forecast is too large.'},{status:413});
 let proposal;
 try{const raw=await request.text();if(raw.length>60000)throw new Error('Forecast is too large.');proposal=validateProposal(JSON.parse(raw));}catch(e){return Response.json({error:e instanceof Error?e.message:'Invalid forecast.'},{status:400});}
 try{const record={...proposal,id:crypto.randomUUID(),createdAt:new Date().toISOString(),author:request.headers.get('oai-authenticated-user-email')?'Owner':'Forecast Ledger owner'};
 await getDb().insert(forecasts).values({...record,evidence:JSON.stringify(record.evidence)});return Response.json({forecast:record},{status:201});
 }catch(e){console.error('Save failed',e);return Response.json({error:'Could not save this forecast. Keep your draft and try again.'},{status:503});}
}
