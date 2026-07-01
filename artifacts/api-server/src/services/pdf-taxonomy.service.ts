import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type { Express } from 'express';
import { classifyDocumentFromExtracted, classifyPerPageFromExtracted, SCANNED_WARNING } from '../lib/pgn-taxonomy/pdf-classifier.js';
import { extractPdfMetadata, extractPdfPages } from '../utils/pdf-text-extractor.js';

export async function classifyUploadedPdf(file: Express.Multer.File, maxPages=20, perPage=false){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'pdf-taxonomy-')); const p=path.join(dir,file.originalname||'upload.pdf');
 try{await fs.writeFile(p,file.buffer); const metadata=await extractPdfMetadata(p); const pages=await extractPdfPages(p,maxPages); return perPage?classifyPerPageFromExtracted(file.originalname,metadata,pages):classifyDocumentFromExtracted(file.originalname,metadata,pages);} 
 catch(e:any){const msg=String(e?.message||e); const warning=/password|encrypt/i.test(msg)?'PDF is encrypted/password-protected and could not be classified.':/Invalid|bad|damaged|parse/i.test(msg)?'PDF appears damaged or unreadable and could not be classified.':msg; return {rows:[],warnings:[warning||SCANNED_WARNING],summary:{pdfs_classified:0,pages_examined:0,total_extracted_characters:0,average_confidence:0,warnings:[warning]}};}
 finally{await fs.rm(dir,{recursive:true,force:true});}
}
