import { getDb } from '@/db';
import { forecasts, outcomes } from '@/db/schema';
import { desc } from 'drizzle-orm';
import { baseline, FORECAST_DEADLINE } from '@/lib/data';
export const dynamic='force-dynamic';
export async function GET(){
 try{
 const db=getDb();const [fs,os]=await Promise.all([db.select().from(forecasts).orderBy(desc(forecasts.createdAt)),db.select().from(outcomes).orderBy(desc(outcomes.createdAt))]);
 return Response.json({forecasts:[...fs.map(f=>({...f,evidence:JSON.parse(f.evidence)})),...baseline],outcomes:os,deadline:FORECAST_DEADLINE,serverTime:new Date().toISOString()},{headers:{'Cache-Control':'no-store'}});
 }catch(e){console.error('Ledger read failed',e);return Response.json({error:'The ledger is temporarily unavailable. Your saved records have not been changed.'},{status:503});}
}
