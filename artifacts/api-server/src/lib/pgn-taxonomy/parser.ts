import fs from 'node:fs';
import path from 'node:path';
import type { PgnHeaders } from './types.js';

export function iterPgnFiles(inputPath: string): string[] {
  const stat = fs.statSync(inputPath);
  if (stat.isFile()) return /\.pgn$/i.test(inputPath) ? [inputPath] : [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(inputPath, { withFileTypes: true })) {
    const full = path.join(inputPath, entry.name);
    if (entry.isDirectory()) files.push(...iterPgnFiles(full));
    else if (/\.pgn$/i.test(entry.name)) files.push(full);
  }
  return files;
}

export function splitGames(rawPgnText: string): string[] {
  const text = rawPgnText.replace(/\r\n?/g, '\n').trim();
  if (!text) return [];
  const starts: number[] = [];
  let inBrace = false, inLine = false, inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inLine) { if (c === '\n') inLine = false; continue; }
    if (c === ';' && !inBrace && !inQuote) { inLine = true; continue; }
    if (c === '{' && !inQuote) { inBrace = true; continue; }
    if (c === '}' && !inQuote) { inBrace = false; continue; }
    if (c === '"' && !inBrace) inQuote = !inQuote;
    if (!inBrace && !inQuote && c === '[' && (i === 0 || text[i - 1] === '\n')) {
      const rest = text.slice(i, i + 12);
      if (/^\[Event\s+"/.test(rest) || (starts.length === 0 && /^\[[A-Za-z0-9_]+\s+"/.test(rest))) starts.push(i);
    }
  }
  if (!starts.length) return [text];
  const games: string[] = [];
  for (let i = 0; i < starts.length; i++) {
    const part = text.slice(starts[i], starts[i + 1] ?? text.length).trim();
    if (part) games.push(part);
  }
  return games;
}

export function parseHeaders(gameText: string): PgnHeaders {
  const headers: PgnHeaders = {};
  const re = /^\[([^\s\]]+)\s+"((?:\\"|[^"])*)"\]\s*$/gm;
  let m: RegExpExecArray | null;
  while ((m = re.exec(gameText))) headers[m[1]] = m[2].replace(/\\"/g, '"');
  return headers;
}
export function extractComments(gameText: string): string[] {
  const out = [...gameText.matchAll(/\{([^}]*)\}/g)].map((m) => m[1].trim());
  for (const line of gameText.split(/\n/)) if (line.trimStart().startsWith(';')) out.push(line.trimStart().slice(1).trim());
  return out;
}
export function stripHeadersAndComments(gameText: string): string {
  return gameText.replace(/^\[[^\n]*\]\s*$/gm, ' ').replace(/\{[^}]*\}/g, ' ').replace(/;[^\n]*/g, ' ').replace(/\([^()]*\)/g, ' ').replace(/\$\d+/g, ' ');
}
export function normalizeText(text: string): string { return text.toLowerCase().replace(/[-–—]/g, ' ').replace(/\s+/g, ' ').trim(); }
