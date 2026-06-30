import { Fragment, useState } from "react";
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

type PgnGame = {
  headers: Record<string, string>;
  moves: PgnMove[];
  raw: string;
};

function splitGames(pgn: string): string[] {
  if (!pgn?.trim()) return [];
  const RESULT = /\b(1-0|0-1|1\/2-1\/2|\*)\s*/g;
  const games: string[] = [];
  let start = 0;
  let m: RegExpExecArray | null;
  RESULT.lastIndex = 0;
  while ((m = RESULT.exec(pgn)) !== null) {
    const end = m.index + m[0].length;
    const chunk = pgn.slice(start, end).trim();
    if (chunk) games.push(chunk);
    start = end;
    // skip blank lines between games
    while (start < pgn.length && pgn[start] === "\n") start++;
    RESULT.lastIndex = start;
  }
  const tail = pgn.slice(start).trim();
  if (tail) games.push(tail);
  return games.filter((g) => g.length > 0);
}

function parseSingleGame(raw: string): PgnGame {
  const headers: Record<string, string> = {};
  const headerRegex = /\[(\w+)\s+"([^"]*)"\]/g;
  let match;
  while ((match = headerRegex.exec(raw)) !== null) {
    headers[match[1]] = match[2];
  }

  const moveText = raw.replace(/\[.*?\]/gs, "").trim();

  let withoutComments = moveText;
  let prev = "";
  while (prev !== withoutComments) {
    prev = withoutComments;
    withoutComments = withoutComments.replace(/\{[^{}]*\}/g, "");
  }

  let withoutVariations = withoutComments;
  prev = "";
  while (prev !== withoutVariations) {
    prev = withoutVariations;
    withoutVariations = withoutVariations.replace(/\([^()]*\)/g, "");
  }

  const cleaned = withoutVariations
    .replace(/\$\d+/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const RESULT_TOKENS = new Set(["*", "1-0", "0-1", "1/2-1/2"]);
  const tokens = cleaned.split(/\s+/);
  const moves: PgnMove[] = [];
  let current: Partial<PgnMove> & { _blackNext?: boolean } = {};

  for (const token of tokens) {
    if (/^\d+\.+/.test(token)) {
      if (current.number !== undefined && current.white && !current._blackNext) {
        moves.push({ number: current.number, white: current.white, black: current.black });
      }
      const isBlackContinuation = /^\d+\.{3}/.test(token);
      current = { number: parseInt(token, 10), _blackNext: isBlackContinuation };
      continue;
    }
    if (token === "...") { current._blackNext = true; continue; }
    if (!token || RESULT_TOKENS.has(token)) continue;
    if (current.number !== undefined) {
      if (current._blackNext) { current.black = token; current._blackNext = false; }
      else if (!current.white) { current.white = token; }
      else if (!current.black) { current.black = token; }
    }
  }
  if (current.number !== undefined && current.white) {
    moves.push({ number: current.number, white: current.white, black: current.black });
  }

  return { headers, moves, raw };
}

function parseAllGames(pgn: string): PgnGame[] {
  const chunks = splitGames(pgn);
  if (chunks.length === 0) return [parseSingleGame(pgn)];
  return chunks.map(parseSingleGame);
}

function gameLabel(game: PgnGame, index: number): string {
  const { headers } = game;
  const white = headers["White"] ?? "?";
  const black = headers["Black"] ?? "?";
  const event = headers["Event"];
  if (white !== "?" || black !== "?") return `${index + 1}. ${white} – ${black}`;
  if (event) return `${index + 1}. ${event}`;
  return `Game ${index + 1}`;
}

export function PgnViewer({ pgn, chapterId, chapterTitle, bookTitle }: Props) {
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [gameIndex, setGameIndex] = useState(0);

  if (!pgn?.trim()) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-stone-400">
        No PGN data stored for this chapter.
      </div>
    );
  }

  const games = parseAllGames(pgn);
  const game = games[Math.min(gameIndex, games.length - 1)];
  const { headers, moves } = game;
  const result = headers["Result"] ?? "*";
  const multiGame = games.length > 1;

  function copyPgn() {
    navigator.clipboard.writeText(game.raw).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  function downloadPgn() {
    const blob = new Blob([game.raw], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const label = headers["White"] && headers["Black"]
      ? `${headers["White"]}-vs-${headers["Black"]}`
      : chapterTitle ?? "game";
    a.download = `${label}.pgn`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAllPgn() {
    const blob = new Blob([pgn], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${chapterTitle ?? "games"}.pgn`;
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
      {multiGame && (
        <div className="border-b border-stone-200 px-5 py-3 flex items-center gap-3">
          <span className="text-xs uppercase tracking-[0.12em] text-stone-400 shrink-0">
            {games.length} games
          </span>
          <select
            value={gameIndex}
            onChange={(e) => setGameIndex(Number(e.target.value))}
            className="flex-1 rounded-xl border border-stone-200 bg-white px-3 py-1.5 text-sm text-stone-800 focus:outline-none focus:ring-1 focus:ring-stone-400"
          >
            {games.map((g, i) => (
              <option key={i} value={i}>
                {gameLabel(g, i)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setGameIndex((i) => Math.max(0, i - 1))}
            disabled={gameIndex === 0}
            className="rounded-full border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-30 whitespace-nowrap"
          >
            ← Prev
          </button>
          <button
            type="button"
            onClick={() => setGameIndex((i) => Math.min(games.length - 1, i + 1))}
            disabled={gameIndex === games.length - 1}
            className="rounded-full border border-stone-200 px-3 py-1.5 text-sm font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-30 whitespace-nowrap"
          >
            Next →
          </button>
        </div>
      )}

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
                <Fragment key={move.number}>
                  <span className="text-stone-400 select-none">{move.number}.</span>
                  <span className="text-stone-800">{move.white}</span>
                  <span className="text-stone-500">{move.black ?? ""}</span>
                </Fragment>
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
            ↓ This game
          </button>
          {multiGame && (
            <button
              type="button"
              onClick={downloadAllPgn}
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
            >
              ↓ All {games.length} games
            </button>
          )}
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
            {game.raw}
          </pre>
        </details>
      </div>
    </div>
  );
}
