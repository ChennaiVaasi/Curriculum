import { Router } from 'express';
import { getCatalog, saveCatalog } from '../lib/catalog.js';
import { classifyFromPgn, classifyFromPdfText } from '../lib/taxonomy-apply.js';
import { classifyDocumentFromExtracted } from '../lib/pgn-taxonomy/pdf-classifier.js';
import type { ChapterTaxonomy } from '../lib/types.js';

const router = Router();

function classifyPdfChapter(
  objectKey: string,
  title: string,
  textPreview?: string,
): ChapterTaxonomy | null {
  // If we have stored first-page text, feed it to the classifier for better results
  if (textPreview?.trim()) {
    return classifyFromPdfText(objectKey, title, textPreview);
  }
  // Fallback: classify from path + title metadata only
  try {
    const result = classifyDocumentFromExtracted(
      objectKey,
      { title, author: '' },
      [],
    );
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

router.post('/catalog/reclassify', async (req, res) => {
  try {
    const { ids } = req.body as { ids?: string[] };
    const catalog = await getCatalog();

    const targets = ids?.length
      ? catalog.chapters.filter((c) => ids.includes(c.id))
      : catalog.chapters;

    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const chapter of targets) {
      try {
        let tax: ChapterTaxonomy | null = null;

        if (chapter.fileType === 'pgn' && chapter.pgn?.trim()) {
          // PGN: use full game text (headers + moves + annotations)
          tax = classifyFromPgn(
            chapter.pgn,
            chapter.sourceFilename || chapter.originalFilename || 'game.pgn',
          );
        } else {
          // PDF: use stored first-page text when available, else path+title
          tax = classifyPdfChapter(
            chapter.objectKey || chapter.originalFilename || chapter.title,
            chapter.title,
            chapter.textPreview,
          );
        }

        if (tax) {
          chapter.taxonomy = tax;
          updated++;
        } else {
          failed++;
        }
      } catch (err: any) {
        errors.push(`${chapter.id}: ${err?.message || String(err)}`);
        failed++;
      }
    }

    await saveCatalog(catalog);

    res.json({ updated, failed, total: targets.length, errors });
  } catch (err) {
    req.log.error({ err }, 'Reclassify failed');
    res.status(500).json({ error: 'Reclassify failed.' });
  }
});

export default router;
