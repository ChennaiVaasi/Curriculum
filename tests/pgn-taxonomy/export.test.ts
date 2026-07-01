import assert from 'node:assert/strict';
import { classifyPgnText } from '../../artifacts/api-server/src/lib/pgn-taxonomy/classifier';
import { exportRows } from '../../artifacts/api-server/src/lib/pgn-taxonomy/export';
const rows = classifyPgnText(`[Event "X"]\n\n{fork pin} 1. e4 *`);
assert(exportRows(rows, 'csv').includes('Fork | Pin'));
assert.equal(exportRows([...rows, ...rows], 'jsonl').trim().split('\n').length, 2);
