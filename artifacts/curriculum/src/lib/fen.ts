export const FEN_NOTEBOOK_KEY = "fen-notebook";

export type NotebookFen = {
  id: string;
  fen: string;
  chapterId: string;
  chapterTitle: string;
  bookTitle?: string;
  sourceMessage: string;
  savedAt: string;
};

const BOARD_PART = /[prnbqkPRNBQK1-8]{1,8}(?:\/[prnbqkPRNBQK1-8]{1,8}){7}/;

const FULL_FEN_PATTERN = new RegExp(
  BOARD_PART.source +
    /\s+[wb]\s+(?:K?Q?k?q?|-)\s+(?:[a-h][36]|-)\s+\d+\s+\d+/.source,
  "g",
);

const SIDE_ONLY_PATTERN = new RegExp(
  BOARD_PART.source + /\s+[wb](?!\S)/.source,
  "g",
);

const BOARD_ONLY_PATTERN = new RegExp(BOARD_PART.source, "g");

function normaliseFen(raw: string): string {
  const parts = raw.trim().split(/\s+/);
  const board = parts[0];
  const side = parts[1] ?? "w";
  const castling = parts[2] ?? "KQkq";
  const ep = parts[3] ?? "-";
  const half = parts[4] ?? "0";
  const full = parts[5] ?? "1";
  return `${board} ${side} ${castling} ${ep} ${half} ${full}`;
}

export function extractFens(text: string): string[] {
  const seen = new Set<string>();
  const results: string[] = [];

  function add(raw: string) {
    const fen = normaliseFen(raw);
    if (!seen.has(fen)) {
      seen.add(fen);
      results.push(fen);
    }
  }

  const fullMatches = [...text.matchAll(FULL_FEN_PATTERN)].map((m) => m[0]);
  fullMatches.forEach(add);

  const fullyConsumed = new RegExp(FULL_FEN_PATTERN.source, "g");
  const stripped = text.replace(fullyConsumed, "");

  const sideMatches = [...stripped.matchAll(SIDE_ONLY_PATTERN)].map((m) => m[0]);
  sideMatches.forEach(add);

  const sideConsumed = new RegExp(SIDE_ONLY_PATTERN.source, "g");
  const stripped2 = stripped.replace(sideConsumed, "");

  const boardMatches = [...stripped2.matchAll(BOARD_ONLY_PATTERN)].map((m) => m[0]);
  boardMatches.forEach(add);

  return results;
}

function escapeTagValue(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function sanitizeComment(value: string) {
  return value.replace(/[{}]/g, "").trim();
}

export function notebookEntryToPgn(entry: NotebookFen) {
  const eventName = entry.bookTitle ? `${entry.bookTitle} - ${entry.chapterTitle}` : entry.chapterTitle;
  const date = entry.savedAt.slice(0, 10).replace(/-/g, ".");
  const sourceComment = sanitizeComment(entry.sourceMessage);

  const lines = [
    `[Event "${escapeTagValue(eventName)}"]`,
    `[Site "Curriculum"]`,
    `[Date "${date}"]`,
    `[Round "-"]`,
    `[White "?"]`,
    `[Black "?"]`,
    `[Result "*"]`,
  ];

  if (entry.fen) {
    lines.push(`[SetUp "1"]`);
    lines.push(`[FEN "${escapeTagValue(entry.fen)}"]`);
  }

  lines.push("", `{${sourceComment}} *`);
  return lines.join("\n");
}

export function notebookToPgn(entries: NotebookFen[]) {
  return entries
    .map((entry) => {
      const withPgn = entry as NotebookFen & { pgn?: string };
      return withPgn.pgn?.trim() || notebookEntryToPgn(entry);
    })
    .join("\n\n");
}
