import { useState, useMemo } from "react";
import { FEN_NOTEBOOK_KEY } from "@/lib/fen";
import {
  makePositionId,
  readNotebookEntries,
  readNotebooks,
  writeNotebookEntries,
  writeNotebooks,
  isValidFen,
  type NotebookEntry,
  type PositionNotebook,
} from "@/lib/position-workflow";
import type { ParsedPgnMove } from "@/lib/pgn-parser";

type Position = { ply: number; fen: string; san?: string; moveNumber?: number; color?: "w" | "b" };

export type SavePositionPayload = {
  fen: string;
  fullPgn?: string;
  moves?: ParsedPgnMove[];
  positions?: Position[];
  currentPly?: number;
  gameHeaders?: Record<string, string>;
  sourceMessage: string;
};

type SaveKind = "position" | "clip" | "full-game";

type Props = {
  payload: SavePositionPayload;
  chapterId: string;
  chapterTitle: string;
  bookTitle?: string;
  onClose: () => void;
};

function splitTags(value: string) {
  return value.split(",").map((t) => t.trim()).filter(Boolean);
}

function moveLabel(p: Position): string {
  if (p.ply === 0) return "Start";
  const mn = p.moveNumber ?? Math.ceil(p.ply / 2);
  return p.color === "w" ? `${mn}. ${p.san}` : `${mn}… ${p.san}`;
}

function buildClipPgn(
  headers: Record<string, string>,
  moves: ParsedPgnMove[],
  positions: Position[],
  fromPly: number,
  toPly: number,
): string {
  const startPos = positions.find((p) => p.ply === fromPly);
  const clipped = moves.filter((m) => m.ply > fromPly && m.ply <= toPly);

  const skipKeys = new Set(["SetUp", "FEN"]);
  let entries = Object.entries(headers).filter(([k]) => !skipKeys.has(k));
  if (fromPly > 0 && startPos) {
    entries = [...entries, ["SetUp", "1"], ["FEN", startPos.fen]];
  }
  const headerLines = entries.map(([k, v]) => `[${k} "${v.replace(/"/g, '\\"')}"]`).join("\n");

  let text = "";
  clipped.forEach((m, i) => {
    if (m.color === "w") {
      text += `${m.moveNumber}. ${m.san} `;
    } else if (i === 0) {
      text += `${m.moveNumber}... ${m.san} `;
    } else {
      text += `${m.san} `;
    }
  });

  return `${headerLines}\n\n${text.trim()} *`;
}

export function SavePositionModal({ payload, chapterId, chapterTitle, bookTitle, onClose }: Props) {
  const hasPgn = Boolean(payload.fullPgn && payload.moves && payload.positions && payload.currentPly !== undefined);
  const defaultKind: SaveKind = payload.fen ? "position" : "clip";

  const [notebooks, setNotebooks] = useState<PositionNotebook[]>(() => readNotebooks());
  const [targetId, setTargetId] = useState(notebooks[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [title, setTitle] = useState(chapterTitle);
  const [tags, setTags] = useState("");
  const [fen, setFen] = useState(payload.fen);
  const [kind, setKind] = useState<SaveKind>(defaultKind);
  const [fromPly, setFromPly] = useState(0);
  const [toPly, setToPly] = useState(payload.currentPly ?? 0);
  const [status, setStatus] = useState("");

  const fenValid = !fen.trim() || isValidFen(fen.trim());

  const pgnPreview = useMemo(() => {
    if (!hasPgn) return undefined;
    if (kind === "full-game") return payload.fullPgn;
    if (kind === "clip")
      return buildClipPgn(
        payload.gameHeaders!,
        payload.moves!,
        payload.positions!,
        fromPly,
        toPly,
      );
    return undefined;
  }, [kind, fromPly, toPly, hasPgn]);

  function save() {
    const now = new Date().toISOString();
    let notebookId = targetId;
    let nextNotebooks = notebooks;

    if (newName.trim()) {
      const nb: PositionNotebook = {
        id: makePositionId("book"),
        name: newName.trim(),
        createdAt: now,
        updatedAt: now,
      };
      nextNotebooks = [nb, ...notebooks];
      notebookId = nb.id;
      writeNotebooks(nextNotebooks);
      setNotebooks(nextNotebooks);
      setTargetId(nb.id);
      setNewName("");
    }

    if (!notebookId) { setStatus("Choose or create a notebook first."); return; }
    if (kind === "position" && !fen.trim()) { setStatus("Enter a FEN position."); return; }
    if (kind === "clip" && fromPly >= toPly) { setStatus("'From' must be before 'To'."); return; }

    const savedFen = kind === "position" ? fen.trim() : "";
    const savedPgn = kind === "position" ? undefined : pgnPreview;

    const existing = readNotebookEntries(FEN_NOTEBOOK_KEY);
    const isDup = existing.some(
      (e) =>
        e.notebookId === notebookId &&
        e.chapterId === chapterId &&
        (savedFen ? e.fen === savedFen : e.pgn === savedPgn),
    );
    if (isDup) { setStatus("Already saved to this notebook."); return; }

    const entry: NotebookEntry = {
      id: makePositionId("entry"),
      notebookId,
      title: title.trim() || chapterTitle,
      fen: savedFen,
      pgn: savedPgn,
      candidateId: undefined,
      tags: splitTags(tags),
      chapterId,
      chapterTitle,
      bookTitle,
      sourceMessage: payload.sourceMessage,
      savedAt: now,
    };

    writeNotebookEntries(FEN_NOTEBOOK_KEY, [entry, ...existing]);
    setStatus("Saved!");
    setTimeout(onClose, 700);
  }

  const saveDisabled =
    (!targetId && !newName.trim()) ||
    (kind === "position" && !fen.trim()) ||
    (kind === "clip" && fromPly >= toPly);

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-stone-950/40 p-6">
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-semibold">Save to notebook</h2>
        <p className="mt-1 text-sm text-stone-500">Choose what to save, pick a notebook, and add tags.</p>

        <div className="mt-5 grid gap-4">
          {hasPgn && (
            <div className="grid gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">What to save</label>
              <div className="flex flex-wrap gap-2">
                {([
                  ["position", "Position (FEN)"],
                  ["clip", "Clip"],
                  ["full-game", "Full game"],
                ] as [SaveKind, string][]).map(([v, label]) => (
                  <button
                    key={v}
                    onClick={() => setKind(v)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      kind === v
                        ? "border-stone-900 bg-stone-900 text-amber-50"
                        : "border-stone-300 text-stone-700 hover:bg-stone-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {kind === "position" && (
            <div className="grid gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">FEN</label>
              <input
                value={fen}
                onChange={(e) => setFen(e.target.value)}
                placeholder="Paste a FEN string…"
                className={`rounded-2xl border px-4 py-3 font-mono text-sm outline-none transition focus:border-stone-900 ${
                  fen && !fenValid ? "border-rose-400 bg-rose-50" : "border-stone-300"
                }`}
              />
              {fen && !fenValid && <p className="text-xs text-rose-600">FEN looks invalid — double-check it.</p>}
            </div>
          )}

          {kind === "clip" && hasPgn && (
            <div className="grid gap-3 rounded-2xl border border-stone-200 bg-stone-50 p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">From</label>
                  <select
                    value={fromPly}
                    onChange={(e) => setFromPly(Number(e.target.value))}
                    className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900"
                  >
                    {payload.positions!.filter((p) => p.ply < toPly).map((p) => (
                      <option key={p.ply} value={p.ply}>{moveLabel(p)}</option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1.5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">To</label>
                  <select
                    value={toPly}
                    onChange={(e) => setToPly(Number(e.target.value))}
                    className="rounded-xl border border-stone-300 bg-white px-3 py-2 text-sm outline-none focus:border-stone-900"
                  >
                    {payload.positions!.filter((p) => p.ply > fromPly && p.ply > 0).map((p) => (
                      <option key={p.ply} value={p.ply}>{moveLabel(p)}</option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-xs text-stone-500">{toPly - fromPly} ply · {Math.ceil((toPly - fromPly) / 2)} moves</p>
            </div>
          )}

          {pgnPreview && (
            <div className="grid gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">PGN preview</label>
              <pre className="max-h-28 overflow-auto rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 font-mono text-xs leading-relaxed text-stone-700 whitespace-pre-wrap break-words">
                {pgnPreview}
              </pre>
            </div>
          )}

          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Title</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm outline-none transition focus:border-stone-900"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">Notebook</label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm outline-none transition focus:border-stone-900"
            >
              <option value="">Choose existing notebook</option>
              {notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>{nb.name}</option>
              ))}
            </select>
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Or type a new notebook name…"
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm outline-none transition focus:border-stone-900"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Tags <span className="normal-case font-normal text-stone-400">(comma separated)</span>
            </label>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="e.g. endgame, rook, tactics"
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm outline-none transition focus:border-stone-900"
            />
          </div>
        </div>

        {status && (
          <p className={`mt-3 text-sm ${status === "Saved!" ? "text-emerald-700" : "text-rose-600"}`}>
            {status}
          </p>
        )}

        <div className="mt-6 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold transition hover:bg-stone-50"
          >
            Cancel
          </button>
          <button
            onClick={save}
            disabled={saveDisabled}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-40"
          >
            Save to notebook
          </button>
        </div>
      </div>
    </div>
  );
}
