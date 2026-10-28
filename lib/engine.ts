import { FORECAST_DEADLINE, races } from './data.ts';
import type { Evidence } from './data.ts';
export function probabilityFromMargin(margin: number, sigma: number) {
 if(!Number.isFinite(margin)||!Number.isFinite(sigma)||sigma<=0) throw new Error('Use a finite margin and a positive uncertainty.');
 const x=Math.abs(margin/sigma), t=1/(1+0.2316419*x);
 const tail=0.3989422804014327*Math.exp(-x*x/2)*t*(0.319381530+t*(-0.356563782+t*(1.781477937+t*(-1.821255978+t*1.330274429))));
 return margin>=0?1-tail:tail;
}
export function brier(probability: number, won: number) {
 if(!Number.isFinite(probability)||probability<0||probability>1||![0,1].includes(won)) throw new Error('Invalid probability or outcome.');
 return (probability-won)**2;
}
export function safeUrl(value: unknown): value is string {
 if(typeof value!=='string'||value.length>2000) return false;
 try {const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&!!u.hostname;} catch {return false;}
}
export function validateProposal(input: unknown) {
 if(!input||typeof input!=='object'||Array.isArray(input)) throw new Error('Provide one forecast JSON object.');
 const v=input as Record<string, unknown>;
 if(!races.some(r=>r.id===v.raceId))throw new Error('Choose a supported race ID.');
 if(typeof v.probability!=='number'||!Number.isFinite(v.probability)||v.probability<=0||v.probability>=1)throw new Error('Probability must be a number strictly between 0 and 1 (for example 0.58).');
 for(const key of ['method','rationale']) if(typeof v[key]!=='string'||(v[key] as string).trim().length<(key==='method'?3:30)||(v[key] as string).length>(key==='method'?120:10000))throw new Error(key==='method'?'Give the method a name (3–120 characters).':'Explain the forecast in 30–10,000 characters.');
 if(!Array.isArray(v.evidence)||v.evidence.length<1||v.evidence.length>20)throw new Error('Include between 1 and 20 evidence sources.');
 const evidence: Evidence[]=v.evidence.map((e: unknown)=>{
  if(!e||typeof e!=='object')throw new Error('Each source needs a title and HTTPS URL.');
  const o=e as Record<string,unknown>;
  if(typeof o.title!=='string'||o.title.trim().length<3||o.title.length>200||!safeUrl(o.url))throw new Error('Each source needs a title (3–200 characters) and a valid HTTPS URL.');
  if(o.note!==undefined&&(typeof o.note!=='string'||o.note.length>2000))throw new Error('Source notes must be text under 2,000 characters.');
  return {title:o.title.trim(),url:o.url,...(o.note?{note:o.note as string}:{})};
 });
 let margin: number|null=null,sigma:number|null=null;
 if(v.margin!=null||v.sigma!=null){
  if(typeof v.margin!=='number'||!Number.isFinite(v.margin)||Math.abs(v.margin)>100||typeof v.sigma!=='number'||!Number.isFinite(v.sigma)||v.sigma<1||v.sigma>30)throw new Error('Model inputs need a margin from −100 to 100 and uncertainty from 1 to 30.');
  margin=v.margin;sigma=v.sigma;
  if(Math.abs(probabilityFromMargin(margin,sigma)-v.probability)>0.0001)throw new Error('Probability does not match the supplied model inputs. Remove margin and sigma for a judgement forecast.');
 }
 return {raceId:v.raceId as string,probability:v.probability,method:(v.method as string).trim(),rationale:(v.rationale as string).trim(),evidence,margin,sigma};
}
export function isLocked(now=new Date()){return now.getTime()>=Date.parse(FORECAST_DEADLINE);}
export function csvCell(value: unknown){let s=String(value??'');if(/^[=+@\-\t\r]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';}
