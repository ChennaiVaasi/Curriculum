import { Router } from 'express';
import { getCatalog, saveCatalog } from '../lib/catalog.js';
import { classifyFromPgn, classifyFromPdfBuffer } from '../lib/taxonomy-apply.js';
import { getBinaryObject, isR2Configured } from '../lib/r2.js';
import path from 'node:path';

const router = Router();

router.post('/api/catalog/reclassify', async (req, res) => {
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
        if (chapter.fileType === 'pgn' && chapter.pgn?.trim()) {
          const tax = classifyFromPgn(chapter.pgn, chapter.sourceFilename || chapter.originalFilename || 'game.pgn');
          if (tax) {
            chapter.taxonomy = tax;
            updated++;
          }
        } else if ((chapter.fileType === 'pdf' || !chapter.fileType) && chapter.objectKey) {
          if (!isR2Configured()) {
            errors.push(`${chapter.id}: R2 not configured, cannot download PDF for classification.`);
            failed++;
            continue;
          }
          const { bytes } = await getBinaryObject(chapter.objectKey);
          const buf = Buffer.from(bytes);
          const filename = path.basename(chapter.objectKey);
          const tax = await classifyFromPdfBuffer(buf, filename);
          if (tax) {
            chapter.taxonomy = tax;
            updated++;
          } else {
            errors.push(`${chapter.id}: PDF classification returned no results.`);
            failed++;
          }
        } else if (chapter.pgn?.trim()) {
          const tax = classifyFromPgn(chapter.pgn, chapter.originalFilename || 'game.pgn');
          if (tax) {
            chapter.taxonomy = tax;
            updated++;
          }
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
