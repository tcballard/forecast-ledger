import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { initialForecasts,validateNational,validateOutcome,FORECAST_DEADLINE } from '../lib/national.ts';
export function openStore(path:string){
 mkdirSync(dirname(path),{recursive:true});const db=new DatabaseSync(path);
 db.exec('PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000; CREATE TABLE IF NOT EXISTS records (id TEXT PRIMARY KEY, kind TEXT NOT NULL, created_at TEXT NOT NULL, payload TEXT NOT NULL);');
 return {
 read(){const rows=db.prepare('SELECT kind,payload FROM records ORDER BY created_at DESC,rowid DESC').all();return {forecasts:[...rows.filter(r=>r.kind==='forecast').map(r=>JSON.parse(r.payload as string)),...initialForecasts],outcomes:rows.filter(r=>r.kind==='outcome').map(r=>JSON.parse(r.payload as string)),serverTime:new Date().toISOString(),deadline:FORECAST_DEADLINE};},
 append(input:unknown,kind:'forecast'|'outcome',now=new Date()){
  const locked=now.getTime()>=Date.parse(FORECAST_DEADLINE);if(kind==='forecast'&&locked||kind==='outcome'&&!locked)throw new Error(kind==='forecast'?'Forecast cutoff has passed.':'Outcomes open after the forecast cutoff.');
  const value=(kind==='forecast'?validateNational:validateOutcome)(input),record={...value,id:randomUUID(),createdAt:now.toISOString()};
  db.prepare('INSERT INTO records(id,kind,created_at,payload) VALUES(?,?,?,?)').run(record.id,kind,record.createdAt,JSON.stringify(record));return record;
 },close(){db.close();}};
}
