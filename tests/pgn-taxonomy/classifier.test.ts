import assert from 'node:assert/strict';
import { classifyPgnText } from '../../artifacts/api-server/src/lib/pgn-taxonomy/classifier';

const sample = `[Event "Test"]\n[White "A"]\n[Black "B"]\n[Result "1-0"]\n[ECO "B90"]\n\n1. e4 c5 {a fork wins} 1-0`;
const rows = classifyPgnText(sample, 'combinations/sample.pgn');
assert.equal(rows.length, 1);
assert.equal(rows[0].opening_family, 'Sicilian Defense');
assert.equal(rows[0].opening_variation, 'Najdorf');
assert(rows[0].primary_themes.includes('Fork'));
assert(rows[0].primary_themes.includes('Mating net'));
assert(rows[0].primary_themes.includes('Sacrifice'));
assert.equal(classifyPgnText(`[Event "Ruy"]\n[ECO "C65"]\n\n1. e4 e5 *`)[0].opening_family, 'Ruy Lopez');
assert.equal(classifyPgnText(`[Event "G"]\n[ECO "D85"]\n\n1. d4 Nf6 *`)[0].opening_family, 'Grunfeld Defense');
const end = classifyPgnText(`[Event "Lucena"]\n[FEN "8/8/8/8/8/8/R5KP/6k1 w - - 0 1"]\n\n{Lucena rook ending} 1. Ra8 *`)[0];
assert.equal(end.phase, 'Endgame');
assert(end.material_tags.includes('Rook endgame'));
assert(end.primary_themes.includes('Lucena'));
assert.deepEqual(classifyPgnText(`[Event "Plain"]\n[White "A"]\n[Black "B"]\n\n1. a3 a6 *`)[0].primary_themes, ['Typical plan']);
