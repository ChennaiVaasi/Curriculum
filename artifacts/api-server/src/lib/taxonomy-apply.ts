import { classifyPgnText } from './pgn-taxonomy/classifier.js';
import { classifyUploadedPdf } from '../services/pdf-taxonomy.service.js';
import type { ChapterTaxonomy } from './types.js';

export function classifyFromPgn(pgn: string, filename: string): ChapterTaxonomy | null {
  if (!pgn.trim()) return null;
  try {
    const rows = classifyPgnText(pgn, filename);
    if (!rows.length) return null;
    const row = rows[0];
    return {
      phase: row.phase,
      domain: row.domain,
      openingFamily: row.opening_family,
      openingVariation: row.opening_variation,
      primaryThemes: row.primary_themes,
      microTags: row.micro_tags,
      structures: row.structures,
      materialTags: row.material_tags,
      confidence: row.confidence,
      classifiedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export async function classifyFromPdfBuffer(
  buffer: Buffer,
  filename: string,
): Promise<ChapterTaxonomy | null> {
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
    const result = await classifyUploadedPdf(fakeFile, 20, false);
    if (!result.rows.length) return null;
    const row = result.rows[0];
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
  } catch {
    return null;
  }
}
