import { Chess, type Move } from "chess.js";

export type ParsedPgnMove = { san: string; moveNumber: number; ply: number; color: "w" | "b"; comment?: string; clock?: string; eval?: string };
export type ParsedPgnGame = { headers: Record<string,string>; raw: string; moves: ParsedPgnMove[]; warnings: string[]; errors: string[]; fingerprint: string };

const RESULTS = new Set(["1-0", "0-1", "1/2-1/2", "*"]);
const HEADER_RE = /^\s*\[([^\s\]]+)\s+"((?:\\"|[^"])*)"\]\s*$/;

export function splitPgnGames(rawText: string): string[] {
  const text = rawText.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const games: string[] = [];
  let current: string[] = [];
  let seenMoveText = false;
  for (const line of text.split("\n")) {
    if (/^\s*\[[^\]]+\]/.test(line) && seenMoveText && current.join("\n").trim()) {
      games.push(current.join("\n").trim());
      current = [];
      seenMoveText = false;
    }
    current.push(line);
    if (line.trim() && !/^\s*\[/.test(line)) seenMoveText = true;
  }
  const tail = current.join("\n").trim();
  if (tail) games.push(tail);
  return games;
}

export function parsePgnHeaders(gameText: string): Record<string,string> {
  const headers: Record<string,string> = {};
  for (const line of gameText.replace(/\r\n?/g, "\n").split("\n")) {
    const match = HEADER_RE.exec(line);
    if (match) headers[match[1]] = match[2].replace(/\\"/g, '"');
    else if (line.trim() && !line.trim().startsWith("[")) break;
  }
  return headers;
}

export function normalizePgnDate(date?: string): string {
  if (!date || date === "????.??.??") return "Unknown";
  const [y = "????", m = "??", d = "??"] = date.split(".");
  return [y, m, d].join(".");
}

function stripHeaders(gameText: string) { return gameText.replace(/^\s*\[[^\n]*\]\s*$/gm, " "); }
function stripVariations(text: string, warnings: string[]) {
  let out = text, prev = "";
  while (out !== prev) { prev = out; out = out.replace(/\([^()]*\)/g, " "); }
  if (/[()]/.test(out)) warnings.push("Nested or malformed variations were ignored for mainline replay but preserved in Raw PGN.");
  return out;
}

export function parseMainlineMoves(gameText: string): ParsedPgnMove[] {
  const warnings: string[] = [];
  return parseMoveText(gameText, warnings).moves;
}

export function extractMoveMetadata(gameText: string) { return parseMoveText(gameText, []).moves.map(({ ply, comment, clock, eval: ev }) => ({ ply, comment, clock, eval: ev })); }

function parseMoveText(gameText: string, warnings: string[]) {
  let text = stripVariations(stripHeaders(gameText), warnings);
  const comments: string[] = [];
  text = text.replace(/;[^\n]*/g, " ").replace(/\{([^}]*)\}/g, (_, c) => ` __COMMENT_${comments.push(String(c).trim()) - 1}__ `);
  text = text.replace(/\$\d+/g, " ").replace(/\d+\.(\.\.)?/g, " ").replace(/\s+/g, " ").trim();
  const moves: ParsedPgnMove[] = [];
  let pending: string[] = [];
  for (const token of text.split(/\s+/).filter(Boolean)) {
    const cm = /^__COMMENT_(\d+)__$/.exec(token);
    if (cm) {
      const commentText = comments[Number(cm[1])] ?? "";
      const last = moves[moves.length - 1];
      if (last) {
        last.comment = [last.comment, commentText].filter(Boolean).join(" ");
        last.clock ||= /\[%clk\s+([^\]]+)\]/.exec(commentText)?.[1];
        last.eval ||= /\[%eval\s+([^\]]+)\]/.exec(commentText)?.[1];
      } else pending.push(commentText);
      continue;
    }
    if (RESULTS.has(token)) continue;
    if (/^\d+\.\.\.$/.test(token) || token === "...") continue;
    const cleanSan = token.replace(/[!?]+$/g, "");
    const comment = pending.join(" ").trim(); pending = [];
    const clock = /\[%clk\s+([^\]]+)\]/.exec(comment)?.[1];
    const ev = /\[%eval\s+([^\]]+)\]/.exec(comment)?.[1];
    const ply = moves.length + 1;
    moves.push({ san: cleanSan, moveNumber: Math.ceil(ply / 2), ply, color: ply % 2 ? "w" : "b", comment: comment || undefined, clock, eval: ev });
  }
  return { moves, warnings };
}

function stableHash(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) { h ^= input.charCodeAt(i); h = Math.imul(h, 16777619); }
  return (h >>> 0).toString(16);
}
export function pgnFingerprint(headers: Record<string,string>, moves: ParsedPgnMove[]) {
  return stableHash(JSON.stringify({ White: headers.White, Black: headers.Black, Date: headers.Date, Result: headers.Result, moves: moves.map(m => m.san).join(" ") }));
}

export function validatePgnGame(gameText: string): ParsedPgnGame {
  const headers = parsePgnHeaders(gameText);
  const warnings: string[] = [];
  for (const key of ["White", "Black", "Result"]) if (!headers[key]) warnings.push(`Missing ${key} header.`);
  if (!headers.Event) warnings.push("Missing Event header; using filename or Unknown Event on import.");
  const parsed = parseMoveText(gameText, warnings);
  const chess = new Chess();
  const errors: string[] = [];
  for (const move of parsed.moves) {
    try { chess.move(move.san); } catch { errors.push(`Invalid SAN at ply ${move.ply}: ${move.san}`); break; }
  }
  const result = headers.Result ?? parsed.moves.at(-1)?.san;
  if (result && headers.Result && !RESULTS.has(headers.Result)) warnings.push(`Unexpected Result header: ${headers.Result}`);
  return { headers, raw: gameText.trim(), moves: parsed.moves, warnings, errors, fingerprint: pgnFingerprint(headers, parsed.moves) };
}

export function parsePgnFile(rawText: string): ParsedPgnGame[] { return splitPgnGames(rawText).map(validatePgnGame); }

export function buildPositions(game: ParsedPgnGame) {
  const chess = new Chess();
  const positions: Array<{ ply: number; fen: string; san?: string; from?: string; to?: string; moveNumber?: number; color?: "w"|"b"; comment?: string; clock?: string; eval?: string }> = [{ ply: 0, fen: chess.fen() }];
  for (const m of game.moves) {
    const played = chess.move(m.san) as Move;
    positions.push({ ply: m.ply, fen: chess.fen(), san: played.san, from: played.from, to: played.to, moveNumber: m.moveNumber, color: m.color, comment: m.comment, clock: m.clock, eval: m.eval });
  }
  return positions;
}
