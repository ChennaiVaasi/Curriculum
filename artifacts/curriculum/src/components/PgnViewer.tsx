import { useState } from "react";
import { FEN_NOTEBOOK_KEY, type NotebookFen } from "@/lib/fen";

type Props = {
  pgn: string;
  chapterId?: string;
  chapterTitle?: string;
  bookTitle?: string;
};

type PgnMove = {
  number: number;
  white: string;
  black?: string;
};

function parsePgn(pgn: string): { headers: Record<string, string>; moves: PgnMove[] } {
  if (!pgn?.trim()) return { headers: {}, moves: [] };

  const headers: Record<string, string> = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;
  while ((match = headerRegex.exec(pgn)) !== null) {
    headers[match[1]] = match[2];
  }

  const moveText = pgn.replace(/\[.*?\]/gs, "").trim();
  const cleaned = moveText
    .replace(/\{[^}]*\}/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/\$\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const tokens = cleaned.split(/\s+/);
  const moves: PgnMove[] = [];
  let current: Partial<PgnMove> = {};

  for (const token of tokens) {
    if (/^\d+\./.test(token)) {
      if (current.number !== undefined && current.white) {
        moves.push(current as PgnMove);
      }
      current = { number: parseInt(token), white: undefined };
    } else if (token && !["*", "1-0", "0-1", "1/2-1/2"].includes(token)) {
      if (current.number !== undefined) {
        if (!current.white) {
          current.white = token;
        } else if (!current.black) {
          current.black = token;
        }
      }
    }
  }
  if (current.number !== undefined && current.white) {
    moves.push(current as PgnMove);
  }

  return { headers, moves };
}

export function PgnViewer({ pgn, chapterId, chapterTitle, bookTitle }: Props) {
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  if (!pgn?.trim()) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-stone-400">
        No PGN data stored for this chapter.
      </div>
    );
  }

  const { headers, moves } = parsePgn(pgn);
  const result = headers["Result"] ?? "*";

  function copyPgn() {
    navigator.clipboard.writeText(pgn).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadPgn() {
    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chapterTitle ?? "game"}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function saveFenToNotebook(fen: string, label: string) {
    if (!chapterId || !chapterTitle) return;
    try {
      const saved = window.localStorage.getItem(FEN_NOTEBOOK_KEY);
      const notebook = saved ? (JSON.parse(saved) as NotebookFen[]) : [];
      if (notebook.find((e) => e.fen === fen && e.chapterId === chapterId)) {
        setSaveStatus("Already in notebook.");
        return;
      }
      const entry: NotebookFen = {
        id: `${chapterId}-pgn-${Date.now()}`,
        fen,
        chapterId,
        chapterTitle,
        bookTitle,
        sourceMessage: label,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(FEN_NOTEBOOK_KEY, JSON.stringify([entry, ...notebook]));
      setSaveStatus("Saved to notebook.");
      setTimeout(() => setSaveStatus(""), 2000);
    } catch {
      setSaveStatus("Could not save.");
    }
  }

  return (
    <div className="flex flex-col">
      {Object.keys(headers).length > 0 && (
        <div className="border-b border-stone-200 px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm sm:grid-cols-3">
            {["White", "Black", "Event", "Date", "Result", "ECO"].map((key) =>
              headers[key] ? (
                <div key={key}>
                  <dt className="text-xs uppercase tracking-[0.12em] text-stone-400">{key}</dt>
                  <dd className="mt-0.5 font-medium text-stone-800">{headers[key]}</dd>
                </div>
              ) : null
            )}
          </dl>
        </div>
      )}

      {moves.length > 0 ? (
        <div className="px-5 py-4">
          <div className="max-h-[480px] overflow-y-auto rounded-[1.25rem] border border-stone-100 bg-stone-50 p-4">
            <div className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1 text-sm font-mono">
              <div className="text-xs uppercase tracking-[0.12em] text-stone-400">#</div>
              <div className="text-xs uppercase tracking-[0.12em] text-stone-400">White</div>
              <div className="text-xs uppercase tracking-[0.12em] text-stone-400">Black</div>
              {moves.map((move) => (
                <>
                  <span key={`${move.number}-n`} className="text-stone-400 select-none">{move.number}.</span>
                  <span key={`${move.number}-w`} className="text-stone-800">{move.white}</span>
                  <span key={`${move.number}-b`} className="text-stone-500">{move.black ?? ""}</span>
                </>
              ))}
              {result !== "*" && (
                <>
                  <span />
                  <span className="col-span-2 font-semibold text-stone-700">{result}</span>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className="border-t border-stone-200 px-5 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={copyPgn}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
          >
            {copied ? "Copied!" : "Copy PGN"}
          </button>
          <button
            type="button"
            onClick={downloadPgn}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
          >
            ↓ Download .pgn
          </button>
          {saveStatus && (
            <span className="text-sm text-stone-500">{saveStatus}</span>
          )}
        </div>
      </div>

      <div className="border-t border-stone-100 px-5 py-4">
        <details className="group">
          <summary className="cursor-pointer text-xs uppercase tracking-[0.12em] text-stone-400 hover:text-stone-600">
            Raw PGN
          </summary>
          <pre className="mt-3 max-h-64 overflow-auto rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4 text-xs leading-6 text-stone-700 whitespace-pre-wrap break-words">
            {pgn}
          </pre>
        </details>
      </div>
    </div>
  );
}
