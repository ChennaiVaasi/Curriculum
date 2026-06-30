import assert from "node:assert/strict";
import { buildPositions, normalizePgnDate, parsePgnFile, splitPgnGames, validatePgnGame } from "./pgn-parser";

const one = `[Event "Rated game"]
[Site "Internet"]
[Date "2026.??.??"]
[Round "-"]
[White "José Núñez"]
[Black "Müller"]
[Result "1-0"]
[WhiteElo "1800"]
[BlackElo "1750"]
[WhiteFideId "123"]
[BlackFideId "456"]
[ECO "C20"]
[Opening "King's Pawn"]
[TimeControl "600+0"]

1. e4 {[%clk 0:10:00] [%eval 0.34] good} e5 {reply [%clk 0:09:58]} 2. Nf3 Nc6 1-0`;
const two = `[White "A"]
[Black "B"]
[Result "*"]

1. d4 d5 *`;

assert.equal(splitPgnGames(`${one}\n\n${two}`).length, 2);
const game = validatePgnGame(one);
assert.equal(game.headers.White, "José Núñez");
assert.equal(game.headers.WhiteElo, "1800");
assert.equal(game.headers.WhiteFideId, "123");
assert.equal(game.moves[0].clock, "0:10:00");
assert.equal(game.moves[0].eval, "0.34");
assert.equal(normalizePgnDate(game.headers.Date), "2026.??.??");
const missingEvent = validatePgnGame(two);
assert.match(missingEvent.warnings.join(" "), /Missing Event/);
assert.equal(missingEvent.errors.length, 0);
const varied = validatePgnGame(`[Event "V"]\n[White "A"]\n[Black "B"]\n[Result "*"]\n\n1. e4 (1. d4 d5) e5 2. Nf3 *`);
assert.deepEqual(varied.moves.map((m) => m.san), ["e4", "e5", "Nf3"]);
assert.ok(buildPositions(varied).at(-1)?.fen.includes(" b "));
assert.equal(parsePgnFile(Array.from({ length: 120 }, () => one).join("\n\n")).length, 120);
console.log("pgn-parser tests passed");
