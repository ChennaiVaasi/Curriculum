import { classifyPgnText } from './pgn-taxonomy/classifier.js';
import { classifyUploadedPdf } from '../services/pdf-taxonomy.service.js';
import { classifyDocumentFromExtracted } from './pgn-taxonomy/pdf-classifier.js';
import type { ChapterTaxonomy } from './types.js';

export type PdfClassifyResult = {
  taxonomy: ChapterTaxonomy;
  textPreview: string;
};

function rowToTaxonomy(row: any): ChapterTaxonomy {
  return {
    phase: row.phase,
    domain: row.domain,
    openingFamily: row.opening_family ?? '',
    openingVariation: row.opening_variation ?? '',
    primaryThemes: row.primary_themes,
    microTags: row.micro_tags,
    structures: row.structures,
    materialTags: row.material_tags,
    confidence: row.confidence,
    classifiedAt: new Date().toISOString(),
  };
}

export function classifyFromPgn(pgn: string, filename: string): ChapterTaxonomy | null {
  if (!pgn.trim()) return null;
  try {
    const rows = classifyPgnText(pgn, filename);
    if (!rows.length) return null;
    return rowToTaxonomy(rows[0]);
  } catch {
    return null;
  }
}

export async function classifyFromPdfBuffer(
  buffer: Buffer,
  filename: string,
): Promise<PdfClassifyResult | null> {
  try {
    const fakeFile = {
      buffer,
      originalname: filename,
      mimetype: 'application/pdf',
      size: buffer.length,
      fieldname: 'file',
      encoding: '7bit',
      stream: undefined as any,
      destination: '',
      path: '',
    } as Express.Multer.File;
    // Only extract first 3 pages at upload time — fast, captures title + chapter intro
    const result = await classifyUploadedPdf(fakeFile, 3, false);
    if (!result.rows.length) return null;
    const row = result.rows[0];
    return {
      taxonomy: rowToTaxonomy(row),
      textPreview: (row.text_preview ?? '').slice(0, 2000),
    };
  } catch {
    return null;
  }
}

export function classifyFromPdfText(
  objectKey: string,
  title: string,
  textPreview: string,
): ChapterTaxonomy | null {
  try {
    const result = classifyDocumentFromExtracted(
      objectKey,
      { title, author: '' },
      textPreview.trim() ? [{ page: 1, text: textPreview }] : [],
    );
    if (!result.rows.length) return null;
    return rowToTaxonomy(result.rows[0]);
  } catch {
    return null;
  }
}
