import assert from 'node:assert/strict';
import { splitGames, parseHeaders } from '../../artifacts/api-server/src/lib/pgn-taxonomy/parser';
const multi = `[Event "One"]\n[Opening "Custom"]\n\n1. e4 {comment} e5 *\n\n[Event "Two"]\n[ECO "C65"]\n\n1. e4 e5 (1... c5) $1 *`;
const games = splitGames(multi);
assert.equal(games.length, 2);
assert.equal(parseHeaders(games[0]).Opening, 'Custom');
assert.equal(parseHeaders(games[1]).ECO, 'C65');
