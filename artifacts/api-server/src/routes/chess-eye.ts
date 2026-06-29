import { Router } from "express";
import { db } from "@workspace/db";
import {
  chessEyePositionsTable,
  insertChessEyePositionSchema,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { Chess } from "chess.js";

const router = Router();

const CHESS_RECOGNITION_PROMPT = `You are a chess diagram recognition expert. Read every chess board diagram in this image with maximum precision.

Work through each diagram METHODICALLY, one square at a time:
1. Find the 8×8 board. Determine its orientation: which color is on the bottom? (If a file/rank labels a–h or 1–8 are printed, USE them. If "a1" is the dark square in the bottom-left, white is on the bottom — the standard orientation.)
2. Scan rank by rank from the TOP row (rank 8) down to the BOTTOM row (rank 1). Within each rank, go LEFT to RIGHT (file a → h).
3. For EACH of the 8 squares in a rank, decide: empty, or which piece and which color.
   - Determine color by the FILL of the piece: White pieces are outlined/hollow/light; Black pieces are solid/filled/dark. Do not guess color from the square shade.
   - Identify the piece by SHAPE: King (cross on top), Queen (crown with points/orb), Rook (castle tower / battlements), Bishop (mitre with a diagonal slit), Knight (horse head), Pawn (small round ball on a base).
4. Before writing a rank, COUNT: pieces + empty squares MUST equal exactly 8. If not, re-scan that rank.
5. Sanity-check the whole board: exactly one white king (K) and exactly one black king (k). No pawns on rank 1 or rank 8. Re-examine if violated.

FEN notation rules:
- UPPERCASE = White pieces: K Q R B N P. lowercase = Black: k q r b n p.
- Numbers = consecutive empty squares in a rank (each rank must total 8).
- Ranks separated by "/", from rank 8 (top) to rank 1 (bottom).
- Append: side to move (w/b), castling rights (KQkq or -), en passant (- or square), 0, 1.
- Side to move: if the diagram caption says "White to move/play" use w; "Black to move/play" use b; "Mate in N" puzzles are almost always White to move (w) unless stated otherwise. Default to w if unknown.

Return ONLY valid JSON with exactly this structure:
{
  "positions": [
    {
      "fen": "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
      "confidence": 95,
      "sideToMove": "black",
      "notes": "After 1.e4"
    }
  ]
}

If no chess diagrams exist in the image: {"positions": []}

Common mistakes to avoid:
- Each rank MUST have exactly 8 squares (pieces + empty squares summing to 8).
- Knight (N/n, horse head) is NOT a Bishop (B/b, mitre) — look carefully at the shape.
- Color is the piece's fill (hollow=white, solid=black), NOT the colour of the square it sits on.
- Do NOT confuse move-notation text, captions, or page decorations with pieces on the board.`;

interface RawPosition {
  fen: string;
  confidence: number;
  sideToMove: string;
  notes?: string;
}

function isValidFenBoard(fen: string): boolean {
  const board = (fen ?? "").trim().split(/\s+/)[0];
  if (!board) return false;
  const ranks = board.split("/");
  if (ranks.length !== 8) return false;
  let whiteKings = 0;
  let blackKings = 0;
  for (let r = 0; r < 8; r++) {
    const rank = ranks[r];
    let count = 0;
    for (const ch of rank) {
      if (ch >= "1" && ch <= "8") {
        count += Number(ch);
      } else if ("prnbqkPRNBQK".includes(ch)) {
        count += 1;
        if (ch === "K") whiteKings++;
        if (ch === "k") blackKings++;
        if ((ch === "P" || ch === "p") && (r === 0 || r === 7)) return false;
      } else {
        return false;
      }
    }
    if (count !== 8) return false;
  }
  return whiteKings === 1 && blackKings === 1;
}

function normalizeFen(fen: string): { board: string; side: string } {
  const parts = (fen ?? "").trim().split(/\s+/);
  return { board: parts[0] ?? "", side: (parts[1] ?? "w").toLowerCase() };
}

function modeNum(nums: number[]): number {
  const counts = new Map<number, number>();
  for (const n of nums) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best = nums[0];
  let bestCount = 0;
  for (const [n, c] of counts) {
    if (c > bestCount) { best = n; bestCount = c; }
  }
  return best;
}

async function geminiGenerateJson(
  imageBase64: string,
  mimeType: string,
  prompt: string,
  model: string,
  maxOutputTokens = 8192
): Promise<string> {
  const apiKey = process.env.AI_INTEGRATIONS_GEMINI_API_KEY ?? "";
  const baseUrl = (
    process.env.AI_INTEGRATIONS_GEMINI_BASE_URL ||
    "https://generativelanguage.googleapis.com/v1beta"
  ).replace(/\/$/, "");

  const url = `${baseUrl}/models/${model}:generateContent`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType, data: imageBase64 } },
            { text: prompt },
          ],
        },
      ],
      generationConfig: {
        responseMimeType: "application/json",
        maxOutputTokens,
      },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText.slice(0, 300)}`);
  }

  const data = await response.json() as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response from Gemini");
  return text;
}

async function callGeminiVisionOnce(
  imageBase64: string,
  mimeType: string,
  model = "gemini-2.5-flash"
): Promise<{ positions: RawPosition[] }> {
  const text = await geminiGenerateJson(imageBase64, mimeType, CHESS_RECOGNITION_PROMPT, model);
  try {
    const parsed = JSON.parse(text) as { positions?: RawPosition[] };
    return { positions: parsed.positions ?? [] };
  } catch {
    throw new Error(`Failed to parse Gemini JSON: ${text.slice(0, 200)}`);
  }
}

function fenBoardToGrid(fen: string): string[][] | null {
  const board = (fen ?? "").trim().split(/\s+/)[0];
  if (!board) return null;
  const ranks = board.split("/");
  if (ranks.length !== 8) return null;
  const grid: string[][] = [];
  for (const rank of ranks) {
    const row: string[] = [];
    for (const ch of rank) {
      if (ch >= "1" && ch <= "8") {
        for (let i = 0; i < Number(ch); i++) row.push("");
      } else if ("prnbqkPRNBQK".includes(ch)) {
        row.push(ch);
      } else {
        return null;
      }
    }
    if (row.length !== 8) return null;
    grid.push(row);
  }
  return grid;
}

function assembleFen(grid: string[][], side: string): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = "";
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const ch = grid[r][c];
      if (ch) {
        if (empty) { row += empty; empty = 0; }
        row += ch;
      } else {
        empty++;
      }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} ${side} - - 0 1`;
}

function voteBoardsPerSquare(positions: RawPosition[]): RawPosition | null {
  const grids = positions.map((p) => fenBoardToGrid(p.fen)).filter((g): g is string[][] => g !== null);
  if (grids.length === 0) return null;
  const total = grids.length;

  const MAX_SQUARE_DIFF = 12;
  for (let i = 0; i < grids.length; i++) {
    for (let j = i + 1; j < grids.length; j++) {
      let diff = 0;
      for (let r = 0; r < 8; r++)
        for (let c = 0; c < 8; c++)
          if (grids[i][r][c] !== grids[j][r][c]) diff++;
      if (diff > MAX_SQUARE_DIFF) return null;
    }
  }

  const voted: string[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => ""));
  let agreementSum = 0;
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const counts = new Map<string, number>();
      for (const g of grids) counts.set(g[r][c], (counts.get(g[r][c]) ?? 0) + 1);
      let best = "";
      let bestCount = 0;
      for (const [code, n] of counts) {
        if (n > bestCount) { best = code; bestCount = n; }
      }
      voted[r][c] = best;
      agreementSum += bestCount / total;
    }
  }

  const sideCounts = new Map<string, number>();
  for (const p of positions) {
    const s = normalizeFen(p.fen).side;
    sideCounts.set(s, (sideCounts.get(s) ?? 0) + 1);
  }
  let side = "w";
  let sideBest = 0;
  for (const [s, n] of sideCounts) {
    if (n > sideBest) { side = s; sideBest = n; }
  }

  const fen = assembleFen(voted, side);
  let confidence = Math.round((agreementSum / 64) * 100);
  if (!isValidFenBoard(fen)) confidence = Math.min(confidence, 45);

  return { fen, confidence, sideToMove: side === "b" ? "black" : "white", notes: positions[0]?.notes };
}

async function callGeminiVision(imageBase64: string, mimeType: string, passes = 3): Promise<{ positions: RawPosition[] }> {
  const model = passes > 1 ? "gemini-2.5-pro" : "gemini-2.5-flash";
  const settled = await Promise.allSettled(
    Array.from({ length: passes }, () => callGeminiVisionOnce(imageBase64, mimeType, model))
  );

  const runs = settled
    .filter((r): r is PromiseFulfilledResult<{ positions: RawPosition[] }> => r.status === "fulfilled")
    .map((r) => r.value.positions.filter((p) => isValidFenBoard(p.fen)));

  if (runs.length === 0) {
    const firstError = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw firstError?.reason ?? new Error("No valid chess positions recognized");
  }

  if (passes === 1 || runs.length === 1) return { positions: runs[0] };

  const nonEmpty = runs.filter((r) => r.length > 0);
  if (nonEmpty.length === 0) return { positions: [] };

  if (nonEmpty.every((r) => r.length === 1)) {
    const consensus = voteBoardsPerSquare(nonEmpty.map((r) => r[0]));
    if (consensus) return { positions: [consensus] };
  }

  const modalCount = modeNum(nonEmpty.map((r) => r.length));
  const votes = new Map<string, { count: number; sample: RawPosition }>();
  for (const run of runs) {
    const seen = new Set<string>();
    for (const c of run) {
      const { board, side } = normalizeFen(c.fen);
      const key = `${board} ${side}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const existing = votes.get(key);
      if (existing) existing.count++;
      else votes.set(key, { count: 1, sample: c });
    }
  }

  const ranked = [...votes.values()].sort((a, b) => b.count - a.count);
  const winners = ranked.slice(0, Math.max(1, modalCount));
  const totalPasses = runs.length;

  const positions = winners.map((w) => {
    const agreement = w.count / totalPasses;
    const confidence =
      w.count < 2 ? 50 : agreement >= 1 ? 98 : agreement >= 0.66 ? 85 : agreement >= 0.5 ? 70 : 60;
    return { ...w.sample, confidence };
  });

  return { positions };
}

// ── Per-square recognition ────────────────────────────────────────────────────

const PER_SQUARE_PROMPT = `You are given a MONTAGE of the 64 squares of ONE chess board. The squares have been sliced apart and laid out on an 8×8 grid, separated by bright MAGENTA gutters so each square is visually isolated.

Layout:
- Files a–h are labelled along the TOP edge; ranks 8 (top) down to 1 (bottom) are labelled along the LEFT edge.
- The TOP row of cells is rank 8 (a8..h8, left→right). The BOTTOM row is rank 1 (a1..h1, left→right).

Classify EACH of the 64 cells INDEPENDENTLY. Judge only what sits inside that one cell; ignore the magenta gutters and the border labels.
- If a cell has no piece, output "empty".
- Otherwise output a 2-character code: first char = colour (w=white, b=black), second char = piece (K, Q, R, B, N, or P).

Return ONLY valid JSON with exactly this shape:
{ "board": [ ["a8","b8","c8","d8","e8","f8","g8","h8"], ... 8 rows top→bottom ..., ["a1","b1","c1","d1","e1","f1","g1","h1"] ] }
where every entry is "empty" or a code like "wN", "bK", "wP". Output exactly 8 rows, each with exactly 8 entries.`;

type CellCode = "" | "wK" | "wQ" | "wR" | "wB" | "wN" | "wP" | "bK" | "bQ" | "bR" | "bB" | "bN" | "bP";
const FILES = "abcdefgh";
function coordFor(r: number, c: number): string { return `${FILES[c]}${8 - r}`; }

function parseCell(raw: unknown): CellCode | null {
  if (typeof raw !== "string") return null;
  const s = raw.trim().toLowerCase();
  if (s === "" || s === "empty" || s === "none" || s === "-" || s === "x") return "";
  const colorMatch = s.match(/[wb]/);
  const pieceMatch = s.match(/[kqrbnp]/);
  if (!colorMatch || !pieceMatch) return null;
  return `${colorMatch[0]}${pieceMatch[0].toUpperCase()}` as CellCode;
}

function parseSquareGrid(text: string): CellCode[][] | null {
  let data: unknown;
  try { data = JSON.parse(text); } catch { return null; }
  const grid: CellCode[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => "" as CellCode));
  const obj = data as { board?: unknown; squares?: unknown };
  if (Array.isArray(obj.board)) {
    if (obj.board.length !== 8) return null;
    for (let r = 0; r < 8; r++) {
      const row = obj.board[r];
      if (!Array.isArray(row) || row.length !== 8) return null;
      for (let c = 0; c < 8; c++) {
        const cell = parseCell(row[c]);
        if (cell === null) return null;
        grid[r][c] = cell;
      }
    }
    return grid;
  }
  if (obj.squares && typeof obj.squares === "object") {
    const map = obj.squares as Record<string, unknown>;
    let seen = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const coord = coordFor(r, c);
        if (coord in map) {
          const cell = parseCell(map[coord]);
          if (cell === null) return null;
          grid[r][c] = cell;
          seen++;
        }
      }
    }
    return seen >= 32 ? grid : null;
  }
  return null;
}

function cellToFenChar(code: CellCode): string {
  if (code === "") return "";
  return code[0] === "w" ? code[1].toUpperCase() : code[1].toLowerCase();
}

function gridToFen(grid: CellCode[][], side: string): string {
  const rows: string[] = [];
  for (let r = 0; r < 8; r++) {
    let row = "";
    let empty = 0;
    for (let c = 0; c < 8; c++) {
      const ch = cellToFenChar(grid[r][c]);
      if (ch) {
        if (empty) { row += empty; empty = 0; }
        row += ch;
      } else { empty++; }
    }
    if (empty) row += empty;
    rows.push(row);
  }
  return `${rows.join("/")} ${side} - - 0 1`;
}

async function callGeminiSquares(montageBase64: string, mimeType: string, passes = 3): Promise<{ fen: string; confidence: number; sideToMove: string; notes?: string; lowConfidenceSquares: string[] }> {
  const model = "gemini-2.5-pro";
  const settled = await Promise.allSettled(
    Array.from({ length: passes }, () => geminiGenerateJson(montageBase64, mimeType, PER_SQUARE_PROMPT, model))
  );

  const grids = settled
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => parseSquareGrid(r.value))
    .filter((g): g is CellCode[][] => g !== null);

  if (grids.length === 0) {
    const firstError = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
    throw firstError?.reason ?? new Error("No valid per-square reads");
  }

  const total = grids.length;
  const voted: CellCode[][] = Array.from({ length: 8 }, () => Array.from({ length: 8 }, () => "" as CellCode));
  const lowConfidenceSquares: string[] = [];
  let agreementSum = 0;

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const counts = new Map<CellCode, number>();
      for (const g of grids) {
        const v = g[r][c];
        counts.set(v, (counts.get(v) ?? 0) + 1);
      }
      let best: CellCode = "";
      let bestCount = 0;
      for (const [code, n] of counts) {
        if (n > bestCount) { best = code; bestCount = n; }
      }
      voted[r][c] = best;
      const agreement = bestCount / total;
      agreementSum += agreement;
      if (agreement < 1) lowConfidenceSquares.push(coordFor(r, c));
    }
  }

  const fen = gridToFen(voted, "w");
  const structurallyValid = isValidFenBoard(fen);
  let confidence = Math.round((agreementSum / 64) * 100);
  let notes = "Read square-by-square";
  if (!structurallyValid) {
    confidence = Math.min(confidence, 45);
    notes = "Read square-by-square — structure check failed, verify in Edit mode";
  }

  return { fen, confidence, sideToMove: "white", notes, lowConfidenceSquares };
}

// ── Score sheet ───────────────────────────────────────────────────────────────

const SCORESHEET_PROMPT = `You are an expert at reading HANDWRITTEN chess score sheets.

The sheet has two parts:
1. HEADER fields — typically Event, Site, Date, Round, White player name, Black player name, and Result.
2. A numbered MOVE TABLE. Read row by row: row 1 White, row 1 Black, row 2 White, etc.

Transcribe every move in Standard Algebraic Notation (SAN).
- Pieces: K Q R B N. Pawns have no letter.
- Castling: O-O (kingside), O-O-O (queenside).
- Do NOT include move numbers inside the moves array.

Return ONLY valid JSON:
{
  "tags": { "event": "", "site": "", "date": "YYYY.MM.DD", "round": "", "white": "", "black": "", "result": "1-0" },
  "moves": ["e4", "e5", "Nf3", "Nc6"],
  "notes": ""
}

Rules:
- Leave a tag as "" if unreadable.
- result: one of "1-0", "0-1", "1/2-1/2", or "*".
- moves: ordered SAN strings.`;

interface ScoresheetTags { event?: string; site?: string; date?: string; round?: string; white?: string; black?: string; result?: string; }
interface RawScoresheet { tags: ScoresheetTags; moves: string[]; notes?: string; }

function parseJsonLoose(text: string): unknown {
  const t = (text ?? "").trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(t); } catch {
    const first = t.indexOf("{");
    const last = t.lastIndexOf("}");
    if (first >= 0 && last > first) {
      try { return JSON.parse(t.slice(first, last + 1)); } catch { return null; }
    }
    return null;
  }
}

function cleanSan(raw: string): string {
  let s = (raw ?? "").trim();
  if (!s) return "";
  s = s.replace(/^\d+\.+\s*/, "").trim();
  if (/^(1-0|0-1|1\/2-1\/2|½-½|\*)$/.test(s)) return "";
  if (/^[0O]-[0O](-[0O])?[+#]?$/.test(s)) s = s.replace(/0/g, "O");
  return s.replace(/\s+/g, "");
}

function normalizeResult(r?: string): string {
  const s = (r ?? "").replace(/\s+/g, "");
  if (s === "1-0") return "1-0";
  if (s === "0-1") return "0-1";
  if (s === "1/2-1/2" || s === "½-½") return "1/2-1/2";
  return "*";
}

function voteTag(values: (string | undefined)[]): string {
  const counts = new Map<string, number>();
  for (const v of values) {
    const s = (v ?? "").trim();
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  }
  let best = "";
  let bestN = 0;
  for (const [v, n] of counts) { if (n > bestN) { best = v; bestN = n; } }
  return best;
}

async function callGeminiScoresheetOnce(imageBase64: string, mimeType: string, model: string): Promise<RawScoresheet> {
  const text = await geminiGenerateJson(imageBase64, mimeType, SCORESHEET_PROMPT, model);
  const data = parseJsonLoose(text) as { tags?: ScoresheetTags; moves?: unknown; notes?: unknown } | null;
  const tags = (data?.tags ?? {}) as ScoresheetTags;
  const moves = Array.isArray(data?.moves) ? (data!.moves as unknown[]).map((m) => cleanSan(String(m))).filter(Boolean) : [];
  return { tags, moves, notes: typeof data?.notes === "string" ? data!.notes : undefined };
}

function buildScoresheetResult(runs: RawScoresheet[]) {
  const moveLists = runs.map((r) => r.moves).filter((m) => m.length > 0);
  const tags = {
    event: voteTag(runs.map((r) => r.tags.event)),
    site: voteTag(runs.map((r) => r.tags.site)),
    date: voteTag(runs.map((r) => r.tags.date)),
    round: voteTag(runs.map((r) => r.tags.round)),
    white: voteTag(runs.map((r) => r.tags.white)),
    black: voteTag(runs.map((r) => r.tags.black)),
    result: normalizeResult(voteTag(runs.map((r) => r.tags.result))),
  };

  const chess = new Chess();
  const playedSan: string[] = [];
  let agreeSum = 0;
  let agreeCount = 0;
  let firstIllegalIndex = -1;
  const maxLen = moveLists.length ? Math.max(...moveLists.map((m) => m.length)) : 0;

  for (let i = 0; i < maxLen; i++) {
    const counts = new Map<string, number>();
    let withMove = 0;
    for (const list of moveLists) {
      const san = list[i];
      if (san) { counts.set(san, (counts.get(san) ?? 0) + 1); withMove++; }
    }
    if (counts.size === 0) break;
    const ordered = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    let played = false;
    for (const [san, votes] of ordered) {
      try {
        const mv = chess.move(san);
        playedSan.push(mv.san);
        agreeSum += votes / Math.max(1, withMove);
        agreeCount++;
        played = true;
        break;
      } catch { /* illegal candidate */ }
    }
    if (!played) { firstIllegalIndex = i; break; }
  }

  let remaining: string[] = [];
  if (firstIllegalIndex >= 0) {
    const longest = moveLists.slice().sort((a, b) => b.length - a.length)[0] ?? [];
    remaining = longest.slice(firstIllegalIndex);
  }

  const moves = [...playedSan, ...remaining];
  const issueIndices: number[] = [];
  if (firstIllegalIndex >= 0) {
    for (let i = firstIllegalIndex; i < moves.length; i++) issueIndices.push(i);
  }

  chess.header("Event", tags.event || "?", "Site", tags.site || "?", "Date", tags.date || "????.??.??", "Round", tags.round || "?", "White", tags.white || "?", "Black", tags.black || "?", "Result", tags.result || "*");
  const pgn = chess.pgn();
  const agreement = agreeCount ? agreeSum / agreeCount : 0;
  const legalRatio = maxLen ? playedSan.length / maxLen : 0;
  const confidence = Math.round(100 * (0.5 * legalRatio + 0.5 * agreement));

  return { tags, moves, pgn, confidence, issueIndices, firstIllegalIndex, notes: runs.find((r) => r.notes)?.notes };
}

// ── Routes ────────────────────────────────────────────────────────────────────

router.post("/chess-eye/scan", async (req, res) => {
  const body = req.body as { imageBase64?: string; mimeType?: string; pageNumber?: number };
  if (!body.imageBase64?.trim()) { res.status(400).json({ error: "imageBase64 is required", positions: [] }); return; }
  try {
    const passes = body.pageNumber === undefined ? 3 : 1;
    const result = await callGeminiVision(body.imageBase64, body.mimeType ?? "image/jpeg", passes);
    res.json(result);
  } catch (err) {
    req.log.error(err, "Chess Eye scan failed");
    res.status(500).json({ error: "Scan failed", positions: [] });
  }
});

router.post("/chess-eye/scan-squares", async (req, res) => {
  const body = req.body as { montageBase64?: string; mimeType?: string };
  if (!body.montageBase64?.trim()) { res.status(400).json({ error: "montageBase64 is required", positions: [] }); return; }
  try {
    const result = await callGeminiSquares(body.montageBase64, body.mimeType ?? "image/jpeg");
    res.json({ positions: [result] });
  } catch (err) {
    req.log.error(err, "Chess Eye per-square scan failed");
    res.status(500).json({ error: "Scan failed", positions: [] });
  }
});

router.post("/chess-eye/scan-scoresheet", async (req, res) => {
  const body = req.body as { imageBase64?: string; mimeType?: string };
  if (!body.imageBase64?.trim()) { res.status(400).json({ error: "imageBase64 is required" }); return; }
  try {
    const settled = await Promise.allSettled(
      Array.from({ length: 3 }, () => callGeminiScoresheetOnce(body.imageBase64!, body.mimeType ?? "image/jpeg", "gemini-2.5-pro"))
    );
    const runs = settled.filter((r): r is PromiseFulfilledResult<RawScoresheet> => r.status === "fulfilled").map((r) => r.value);
    if (runs.length === 0) {
      const firstError = settled.find((r) => r.status === "rejected") as PromiseRejectedResult | undefined;
      throw firstError?.reason ?? new Error("Failed to read score sheet");
    }
    res.json(buildScoresheetResult(runs));
  } catch (err) {
    req.log.error(err, "Chess Eye score sheet scan failed");
    res.status(500).json({ error: "Scan failed" });
  }
});

router.get("/chess-eye/positions", async (req, res) => {
  try {
    const positions = await db.select().from(chessEyePositionsTable).orderBy(desc(chessEyePositionsTable.createdAt));
    res.json(positions.map((p) => ({ ...p, createdAt: p.createdAt.toISOString() })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to fetch positions" });
  }
});

router.post("/chess-eye/positions", async (req, res) => {
  const body = req.body as { title?: string; fen?: string; pgn?: string; notes?: string; engineEval?: number };
  if (!body.fen?.trim()) { res.status(400).json({ error: "fen is required" }); return; }
  try {
    const [pos] = await db.insert(chessEyePositionsTable).values({
      title: body.title ?? "Untitled Position",
      fen: body.fen,
      pgn: body.pgn,
      notes: body.notes,
      engineEval: body.engineEval,
    }).returning();
    res.status(201).json({ ...pos, createdAt: pos.createdAt.toISOString() });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to save position" });
  }
});

router.delete("/chess-eye/positions/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(chessEyePositionsTable).where(eq(chessEyePositionsTable.id, id));
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Failed to delete position" });
  }
});

export default router;
