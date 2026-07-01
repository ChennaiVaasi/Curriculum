import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import type { PdfMetadata, PdfPage } from '../lib/pgn-taxonomy/pdf-classifier.js';

const require = createRequire(import.meta.url);
async function loadPdfjs(): Promise<any> {
  try { const spec='pdfjs-dist/legacy/build/pdf.mjs'; return await import(spec); } catch {}
  const p = path.resolve(process.cwd(), '../curriculum/node_modules/pdfjs-dist/legacy/build/pdf.mjs');
  try { return await import(p); } catch {}
  const resolved = require.resolve('pdfjs-dist/legacy/build/pdf.mjs', { paths: [process.cwd(), path.resolve(process.cwd(), '../curriculum')] });
  return import(resolved);
}
export async function extractPdfMetadata(filePath:string):Promise<PdfMetadata>{
  const data=new Uint8Array(await fs.readFile(filePath)); const pdfjs=await loadPdfjs(); const doc=await pdfjs.getDocument({data,disableWorker:true}).promise; const meta=await doc.getMetadata().catch(()=>({info:{},metadata:null}));
  const info=meta.info||{}; return {title:String(info.Title||''),author:String(info.Author||''),raw:info};
}
export async function extractPdfPages(filePath:string,maxPages=20):Promise<PdfPage[]>{
  const data=new Uint8Array(await fs.readFile(filePath)); const pdfjs=await loadPdfjs(); const doc=await pdfjs.getDocument({data,disableWorker:true}).promise; const total=Math.min(doc.numPages,Math.max(1,maxPages)); const pages:PdfPage[]=[];
  for(let i=1;i<=total;i++){const page=await doc.getPage(i); const content=await page.getTextContent(); pages.push({page:i,text:content.items.map((it:any)=>it.str||'').join(' ').trim()});}
  return pages;
}
export async function iterPdfFiles(inputPath:string):Promise<string[]>{const st=await fs.stat(inputPath); if(st.isFile()) return inputPath.toLowerCase().endsWith('.pdf')?[inputPath]:[]; const out:string[]=[]; for(const d of await fs.readdir(inputPath,{withFileTypes:true})){const p=path.join(inputPath,d.name); if(d.isDirectory()) out.push(...await iterPdfFiles(p)); else if(d.isFile()&&d.name.toLowerCase().endsWith('.pdf')) out.push(p);} return out;}
