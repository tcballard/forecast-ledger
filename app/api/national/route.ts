import { getDb } from '@/db';
import { nationalForecasts,nationalOutcomes } from '@/db/schema';
import { initialForecasts,FORECAST_DEADLINE } from '@/lib/national';
import { desc } from 'drizzle-orm';
export async function GET(){try{const db=getDb();const [fs,os]=await Promise.all([db.select().from(nationalForecasts).orderBy(desc(nationalForecasts.createdAt)),db.select().from(nationalOutcomes).orderBy(desc(nationalOutcomes.createdAt))]);return Response.json({forecasts:[...fs.map(r=>JSON.parse(r.payload)),...initialForecasts],outcomes:os.map(r=>JSON.parse(r.payload)),serverTime:new Date().toISOString(),deadline:FORECAST_DEADLINE},{headers:{'Cache-Control':'no-store'}});}catch{return Response.json({error:'Ledger unavailable. Please retry; no records have changed.'},{status:503});}}
