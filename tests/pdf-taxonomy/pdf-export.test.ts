import assert from 'node:assert/strict';
import { exportPdfRows } from '../../artifacts/api-server/src/lib/pgn-taxonomy/pdf-export';
const rows=[{source_file:'a.pdf',primary_themes:['Fork','Pin'],micro_tags:['Back rank'],structures:[],material_tags:['Rook endgame']}];
assert.equal(exportPdfRows(rows,'jsonl').trim().split('\n').length,1);
const csv=exportPdfRows(rows,'csv');
assert(csv.includes('Fork | Pin'));
assert.equal(csv.split('\n')[0].includes('material_tags'),true);
