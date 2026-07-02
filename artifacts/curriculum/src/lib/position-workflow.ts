import { extractFens, type NotebookFen } from "@/lib/fen";

export const IMPORT_CANDIDATES_KEY = "position-import-candidates";
export const NOTEBOOKS_KEY = "position-notebooks";

export type ImportCandidate = {
  id: string;
  title: string;
  fen: string;
  pgn?: string;
  tags: string[];
  sourceType: "pgn" | "pdf" | "manual";
  sourceName: string;
  importedAt: string;
  validationStatus: "valid" | "invalid" | "missing-fen";
  duplicate: boolean;
  deleted?: boolean;
};

export type PositionNotebook = {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
};

export type NotebookEntry = NotebookFen & {
  notebookId: string;
  title: string;
  tags: string[];
  pgn?: string;
  candidateId?: string;
};

function safeRead<T>(key: string, fallback: T): T {
  try {
    const saved = window.localStorage.getItem(key);
    return saved ? (JSON.parse(saved) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function makePositionId(prefix = "pos") {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function readImportCandidates() {
  return safeRead<ImportCandidate[]>(IMPORT_CANDIDATES_KEY, []);
}

export function writeImportCandidates(candidates: ImportCandidate[]) {
  write(IMPORT_CANDIDATES_KEY, candidates);
}

export function readNotebooks() {
  return safeRead<PositionNotebook[]>(NOTEBOOKS_KEY, []);
}

export function writeNotebooks(notebooks: PositionNotebook[]) {
  write(NOTEBOOKS_KEY, notebooks);
}

export function readNotebookEntries(key: string) {
  return safeRead<NotebookEntry[]>(key, []);
}

export function writeNotebookEntries(key: string, entries: NotebookEntry[]) {
  write(key, entries);
}

export function isValidFen(fen: string) {
  const parts = fen.trim().split(/\s+/);
  if (parts.length !== 6) return false;
  const ranks = parts[0].split("/");
  if (ranks.length !== 8) return false;
  return (
    ranks.every((rank) => {
      let count = 0;
      for (const char of rank) {
        if (/^[1-8]$/.test(char)) count += Number(char);
        else if (/^[prnbqkPRNBQK]$/.test(char)) count += 1;
        else return false;
      }
      return count === 8;
    }) &&
    /^[wb]$/.test(parts[1]) &&
    /^(K?Q?k?q?|-)$/.test(parts[2]) &&
    /^(-|[a-h][36])$/.test(parts[3])
  );
}

function pgnChunks(text: string) {
  const chunks = text
    .split(/\n\s*\n(?=\[Event\s+")/g)
    .map((chunk) => chunk.trim())
    .filter(Boolean);
  return chunks.length ? chunks : [text.trim()].filter(Boolean);
}

function tagValue(pgn: string, tag: string) {
  return pgn.match(new RegExp(`\\[${tag}\\s+"([^"]*)"\\]`))?.[1];
}

export function candidatesFromPgnText(
  text: string,
  sourceName: string,
  baseTags: string[] = [],
): ImportCandidate[] {
  const existing = readImportCandidates();
  const knownFens = new Set(
    existing.map((candidate) => candidate.fen).filter(Boolean),
  );
  return pgnChunks(text).flatMap<ImportCandidate>((chunk, index) => {
    const fens = extractFens(chunk);
    const title = tagValue(chunk, "Event") || `${sourceName} game ${index + 1}`;
    const tags = [
      ...new Set(
        [
          ...baseTags,
          tagValue(chunk, "Opening"),
          tagValue(chunk, "ECO"),
        ].filter(Boolean) as string[],
      ),
    ];
    if (fens.length === 0) {
      return [
        {
          id: makePositionId("cand"),
          title,
          fen: "",
          pgn: chunk,
          tags,
          sourceType: "pgn" as const,
          sourceName,
          importedAt: new Date().toISOString(),
          validationStatus: "missing-fen" as const,
          duplicate: false,
        },
      ];
    }
    return fens.map((fen, fenIndex) => {
      const duplicate = knownFens.has(fen);
      knownFens.add(fen);
      return {
        id: makePositionId("cand"),
        title: fens.length > 1 ? `${title} #${fenIndex + 1}` : title,
        fen,
        pgn: chunk,
        tags,
        sourceType: "pgn" as const,
        sourceName,
        importedAt: new Date().toISOString(),
        validationStatus: isValidFen(fen)
          ? ("valid" as const)
          : ("invalid" as const),
        duplicate,
      };
    });
  });
}

export function appendImportCandidates(candidates: ImportCandidate[]) {
  if (candidates.length === 0) return;
  writeImportCandidates([...candidates, ...readImportCandidates()]);
}
