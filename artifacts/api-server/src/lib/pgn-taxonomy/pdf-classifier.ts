import path from 'node:path';
import { normalizeText } from './parser.js';
import { inferDomain, inferMaterial, inferPhase, inferThemes } from './classifier.js';
import { inferOpeningFromText } from './pdf-opening-patterns.js';

export const SCANNED_WARNING = 'This appears to be a scanned/image PDF. OCR is required before reliable classification.';
export type PdfMetadata = { title: string; author: string; raw?: Record<string, unknown> };
export type PdfPage = { page: number; text: string };
export type PdfTaxonomyRow = { source_file:string; page?:number; title:string; author?:string; pages_examined?:number; extracted_chars?:number; opening_family:string|null; opening_variation:string|null; opening_subvariation:string|null; phase:string; domain:string; primary_themes:string[]; micro_tags:string[]; structures:string[]; material_tags:string[]; confidence:number; warnings?:string[]; metadata?:PdfMetadata; text_preview?:string };

export function inferTitle(filePath:string, metadata:Partial<PdfMetadata>, normalizedText:string):string{
  if(metadata.title?.trim()) return metadata.title.trim();
  const first=normalizedText.split(/\n+/).map(s=>s.trim()).find(s=>s.length>3&&s.length<120);
  return first || path.basename(filePath, path.extname(filePath));
}
export function confidenceScore(hasMetadata:boolean, hasOpening:boolean, primary:string[], micro:string[], chars:number):number{let x=0.2;if(hasMetadata)x+=0.1;if(hasOpening)x+=0.15;x+=Math.min(0.25,primary.length*0.06);x+=Math.min(0.1,micro.length*0.02);if(chars>3000)x+=0.1;else if(chars>500)x+=0.05;return Math.round(Math.min(0.95,x)*100)/100;}
function pageConfidence(chars:number){return Math.round(Math.min(0.85,0.25+(0.02*chars)/100)*100)/100;}
function classifyText(source:string,title:string,author:string,metadata:PdfMetadata,text:string,page?:number):PdfTaxonomyRow{
  const pathText=normalizeText(source); const normalized=normalizeText([source,title,author,text].join(' ')); const opening=inferOpeningFromText(normalized);
  const phase=inferPhase(pathText,normalized); const domain=inferDomain(pathText,normalized,phase); const th=inferThemes(pathText,normalized,phase,domain);
  if(!th.primary_themes.length) th.primary_themes = page !== undefined ? (domain==='Tactics'?['Mating net']:['Typical plan']) : (domain==='Endgame'?['King activity']:domain==='Tactics'?['Mating net']:['Typical plan']);
  const material_tags=inferMaterial(pathText+' '+normalized,undefined,phase); const chars=text.length;
  return {source_file:source,page,title,author,opening_family:opening.family,opening_variation:opening.variation,opening_subvariation:opening.subvariation,phase,domain,...th,material_tags,confidence:page!==undefined?pageConfidence(chars):confidenceScore(Boolean(metadata.title||metadata.author||metadata.raw),Boolean(opening.family),th.primary_themes,th.micro_tags,chars),text_preview:text.slice(0,1200),metadata};
}
export function classifyDocumentFromExtracted(source:string,metadata:PdfMetadata,pages:PdfPage[]):{rows:PdfTaxonomyRow[];warnings:string[];summary:Record<string,unknown>}{
  const text=pages.map(p=>p.text).join('\n\n'); const title=inferTitle(source,metadata,text); const warnings:string[]=[]; if(!text.trim()) warnings.push(SCANNED_WARNING); else if(text.length<500) warnings.push('Less than 500 extracted characters; classification confidence may be limited.');
  const row=classifyText(source,title,metadata.author||'',metadata,text); row.pages_examined=pages.length; row.extracted_chars=text.length; row.warnings=warnings;
  return {rows:[row],warnings,summary:summarizeRows([row],warnings)};
}
export function classifyPerPageFromExtracted(source:string,metadata:PdfMetadata,pages:PdfPage[]):{rows:PdfTaxonomyRow[];warnings:string[];summary:Record<string,unknown>}{
  const joined=pages.map(p=>p.text).join('\n'); const title=inferTitle(source,metadata,joined); const warnings:string[]=[]; if(!joined.trim()) warnings.push(SCANNED_WARNING);
  const rows=pages.map(p=>{const r=classifyText(source,title,metadata.author||'',metadata,p.text,p.page); r.warnings=p.text.trim()?[]:[SCANNED_WARNING]; return r;});
  return {rows,warnings,summary:summarizeRows(rows,warnings)};
}
export function summarizeRows(rows:PdfTaxonomyRow[],warnings:string[]=[]){const avg=rows.length?Math.round(rows.reduce((s,r)=>s+r.confidence,0)/rows.length*100)/100:0;return {pdfs_classified:new Set(rows.map(r=>r.source_file)).size,pages_examined:rows.reduce((s,r)=>s+(r.pages_examined||0),0)||rows.length,total_extracted_characters:rows.reduce((s,r)=>s+(r.extracted_chars||0),0),main_domains:[...new Set(rows.map(r=>r.domain))],main_phases:[...new Set(rows.map(r=>r.phase))],average_confidence:avg,warnings};}
