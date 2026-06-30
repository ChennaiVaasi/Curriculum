import { createHash } from "node:crypto";

export type ImportGame = { raw: string; headers: Record<string,string>; fingerprint: string; warnings: string[]; error?: string };
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
export function parsePgnHeaders(gameText: string) {
  const headers: Record<string,string> = {};
  for (const line of gameText.split(/\r?\n/)) {
    const m = HEADER_RE.exec(line);
    if (m) headers[m[1]] = m[2].replace(/\\"/g, '"');
    else if (line.trim() && !line.trim().startsWith("[")) break;
  }
  return headers;
}
function cleanMoveText(gameText: string) {
  let text = gameText.replace(/^\s*\[[^\n]*\]\s*$/gm, " ");
  let prev = "";
  while (prev !== text) { prev = text; text = text.replace(/\([^()]*\)/g, " "); }
  return text.replace(/\{[^}]*\}/g, " ").replace(/;[^\n]*/g, " ").replace(/\$\d+/g, " ").replace(/\d+\.(\.\.)?/g, " ").replace(/\s+/g, " ").trim();
}
export function parseImportGames(rawText: string): ImportGame[] {
  return splitPgnGames(rawText).map((raw) => {
    const headers = parsePgnHeaders(raw);
    const warnings: string[] = [];
    for (const key of ["White", "Black", "Result"]) if (!headers[key]) warnings.push(`Missing ${key} header.`);
    if (!headers.Event) warnings.push("Missing Event header; imported with filename context.");
    const cleaned = cleanMoveText(raw);
    const hasMove = /(?:^|\s)(?:[NBKRQ]?[a-h]?[1-8]?x?[a-h][1-8]|O-O(?:-O)?)/.test(cleaned);
    const fingerprint = createHash("sha256").update(JSON.stringify({ White: headers.White, Black: headers.Black, Date: headers.Date, Result: headers.Result, moves: cleaned })).digest("hex");
    return { raw: raw.trim(), headers, fingerprint, warnings, error: hasMove ? undefined : "No recognizable mainline moves found." };
  });
}
