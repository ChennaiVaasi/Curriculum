import { useEffect, useMemo, useState } from "react";
import { Chessboard } from "react-chessboard";
import { FEN_NOTEBOOK_KEY, type NotebookFen } from "@/lib/fen";
import { buildPositions, normalizePgnDate, parsePgnFile, type ParsedPgnGame } from "@/lib/pgn-parser";

type Props = { pgn: string; chapterId?: string; chapterTitle?: string; bookTitle?: string };

type Tab = "moves" | "headers" | "raw" | "errors";

function statusFor(game: ParsedPgnGame) { return game.errors.length ? "failed" : game.warnings.length ? "warning" : "success"; }
function badgeClass(status: string) {
  if (status === "failed") return "bg-rose-100 text-rose-700";
  if (status === "warning") return "bg-amber-100 text-amber-800";
  return "bg-emerald-100 text-emerald-700";
}
function gameLabel(game: ParsedPgnGame, index: number) { return `${index + 1}. ${game.headers.White ?? "?"} – ${game.headers.Black ?? "?"}`; }

export function PgnViewer({ pgn, chapterId, chapterTitle, bookTitle }: Props) {
  const [copied, setCopied] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");
  const [gameIndex, setGameIndex] = useState(0);
  const [ply, setPly] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [filter, setFilter] = useState("");
  const [tab, setTab] = useState<Tab>("moves");

  const games = useMemo(() => parsePgnFile(pgn), [pgn]);
  const game = games[Math.min(gameIndex, Math.max(games.length - 1, 0))];
  const positions = useMemo(() => (game ? buildPositions(game) : []), [game]);
  const current = positions[Math.min(ply, Math.max(positions.length - 1, 0))];

  useEffect(() => setPly(0), [gameIndex]);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") setPly((p) => Math.min(positions.length - 1, p + 1));
      if (event.key === "ArrowLeft") setPly((p) => Math.max(0, p - 1));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [positions.length]);

  if (!pgn?.trim() || !game) return <div className="flex h-48 items-center justify-center text-sm text-stone-400">Upload or paste a PGN file to begin.</div>;

  const summary = games.reduce((acc, g) => { acc[statusFor(g)]++; return acc; }, { success: 0, failed: 0, warning: 0 } as Record<string, number>);
  const filteredGames = games.map((g, i) => ({ g, i })).filter(({ g }) => !filter || [g.headers.White, g.headers.Black, g.headers.Event, g.headers.Result, g.headers.Opening, g.headers.ECO].join(" ").toLowerCase().includes(filter.toLowerCase()));
  const squareStyles = current?.from && current?.to ? { [current.from]: { backgroundColor: "rgba(245, 158, 11, .45)" }, [current.to]: { backgroundColor: "rgba(245, 158, 11, .65)" } } : {};

  function copyPgn() { navigator.clipboard.writeText(game.raw).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }
  function copyFen() { if (current) navigator.clipboard.writeText(current.fen); }
  function saveFenToNotebook() {
    if (!chapterId || !chapterTitle || !current) return;
    try {
      const saved = window.localStorage.getItem(FEN_NOTEBOOK_KEY);
      const notebook = saved ? (JSON.parse(saved) as NotebookFen[]) : [];
      if (notebook.find((e) => e.fen === current.fen && e.chapterId === chapterId)) return setSaveStatus("Already in notebook.");
      const entry: NotebookFen = { id: `${chapterId}-pgn-${Date.now()}`, fen: current.fen, chapterId, chapterTitle, bookTitle, sourceMessage: `${gameLabel(game, gameIndex)} ply ${current.ply}`, savedAt: new Date().toISOString() };
      window.localStorage.setItem(FEN_NOTEBOOK_KEY, JSON.stringify([entry, ...notebook]));
      setSaveStatus("Saved to notebook.");
    } catch { setSaveStatus("Could not save."); }
  }

  return (
    <div className="grid gap-4 p-4">
      <section className="grid gap-3 rounded-[1.5rem] border border-stone-200 bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div><p className="text-sm font-semibold text-stone-800">PGN import summary</p><p className="text-xs text-stone-500">Total {games.length} · Imported {summary.success} · Warnings {summary.warning} · Failed {summary.failed} · Duplicates handled on upload</p></div>
          <div className="flex flex-wrap gap-2"><button className="rounded-full border px-3 py-1.5 text-xs font-semibold" onClick={copyPgn}>{copied ? "Copied!" : "Copy PGN"}</button><button className="rounded-full border px-3 py-1.5 text-xs font-semibold" onClick={copyFen}>Copy FEN</button><button className="rounded-full border px-3 py-1.5 text-xs font-semibold" onClick={saveFenToNotebook}>Save selected game</button><span className="text-xs text-stone-500 self-center">{saveStatus}</span></div>
        </div>
      </section>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(360px,1fr)_360px]">
        <aside className="rounded-[1.5rem] border border-stone-200 bg-white p-3">
          <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Search player, event, ECO…" className="mb-3 w-full rounded-xl border px-3 py-2 text-sm" />
          <div className="max-h-[620px] overflow-y-auto pr-1 grid gap-2">
            {filteredGames.slice(0, 300).map(({ g, i }) => <button key={`${g.fingerprint}-${i}`} onClick={() => setGameIndex(i)} className={`text-left rounded-xl border p-3 ${i === gameIndex ? "border-stone-900 bg-stone-50" : "border-stone-100 hover:bg-stone-50"}`}><div className="flex gap-2 justify-between"><span className="text-sm font-semibold truncate">{gameLabel(g, i)}</span><span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${badgeClass(statusFor(g))}`}>{statusFor(g)}</span></div><p className="mt-1 text-xs text-stone-500 truncate">{normalizePgnDate(g.headers.Date)} · {g.headers.Event ?? "Unknown Event"}</p><p className="mt-1 text-xs text-stone-400 truncate">{g.headers.ECO ?? ""} {g.headers.Opening ?? ""} {g.headers.WhiteElo || g.headers.BlackElo ? `· ${g.headers.WhiteElo ?? "?"}/${g.headers.BlackElo ?? "?"}` : ""}</p></button>)}
          </div>
        </aside>

        <main className="rounded-[1.5rem] border border-stone-200 bg-white p-4">
          <div className="mx-auto max-w-[560px]"><Chessboard options={{ position: current?.fen, boardOrientation: flipped ? "black" : "white", squareStyles, allowDragging: false, showAnimations: false }} /></div>
          <div className="mt-4 flex flex-wrap justify-center gap-2"><button className="rounded-full border px-3 py-1.5 text-sm" onClick={() => setPly(0)}>First</button><button className="rounded-full border px-3 py-1.5 text-sm" onClick={() => setPly((p) => Math.max(0, p - 1))}>Previous</button><span className="px-3 py-1.5 text-sm text-stone-500">Ply {current?.ply ?? 0}/{positions.length - 1}</span><button className="rounded-full border px-3 py-1.5 text-sm" onClick={() => setPly((p) => Math.min(positions.length - 1, p + 1))}>Next</button><button className="rounded-full border px-3 py-1.5 text-sm" onClick={() => setPly(positions.length - 1)}>Last</button><button className="rounded-full border px-3 py-1.5 text-sm" onClick={() => setFlipped((v) => !v)}>Flip board</button></div>
        </main>

        <section className="rounded-[1.5rem] border border-stone-200 bg-white">
          <div className="grid grid-cols-4 border-b text-xs font-semibold">{(["moves", "headers", "raw", "errors"] as Tab[]).map((t) => <button key={t} onClick={() => setTab(t)} className={`px-2 py-3 capitalize ${tab === t ? "bg-stone-900 text-amber-50" : "text-stone-500"}`}>{t}</button>)}</div>
          <div className="max-h-[640px] overflow-auto p-4 text-sm">
            {tab === "moves" && <div className="grid grid-cols-[auto_1fr_1fr] gap-x-3 gap-y-1 font-mono">{Array.from({ length: Math.ceil(game.moves.length / 2) }, (_, row) => { const w = game.moves[row * 2]; const b = game.moves[row * 2 + 1]; return [<span key={`${row}-n`} className="text-stone-400">{row + 1}.</span>, <button key={`${row}-w`} onClick={() => setPly(w?.ply ?? 0)} className={`text-left ${ply === w?.ply ? "bg-amber-100" : ""}`}>{w?.san} {w?.clock && <span className="text-[10px] text-stone-400">{w.clock}</span>}</button>, <button key={`${row}-b`} onClick={() => b && setPly(b.ply)} className={`text-left ${ply === b?.ply ? "bg-amber-100" : ""}`}>{b?.san} {b?.clock && <span className="text-[10px] text-stone-400">{b.clock}</span>}</button>]; })}</div>}
            {tab === "headers" && <dl className="grid grid-cols-2 gap-3">{["Event","Site","Date","Round","White","Black","Result","WhiteElo","BlackElo","WhiteFideId","BlackFideId","ECO","Opening","TimeControl"].map((k) => <div key={k}><dt className="text-[10px] uppercase tracking-wider text-stone-400">{k}</dt><dd className="font-medium text-stone-800">{gValue(game, k)}</dd></div>)}</dl>}
            {tab === "raw" && <pre className="whitespace-pre-wrap break-words text-xs leading-6">{game.raw}</pre>}
            {tab === "errors" && <div className="grid gap-2">{[...game.errors, ...game.warnings].length ? [...game.errors, ...game.warnings].map((m, i) => <p key={i} className="rounded-xl bg-stone-50 p-3 text-stone-700">{m}</p>) : <p className="text-stone-500">No parser errors or warnings.</p>}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
function gValue(game: ParsedPgnGame, key: string) { return key === "Date" ? normalizePgnDate(game.headers[key]) : game.headers[key] || "—"; }
