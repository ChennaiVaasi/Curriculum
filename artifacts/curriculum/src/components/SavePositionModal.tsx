import { useState } from "react";
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

export type SavePositionPayload = {
  fen: string;
  fullPgn?: string;
  moves?: ParsedPgnMove[];
  currentPly?: number;
  gameHeaders?: Record<string, string>;
  sourceMessage: string;
};

type SaveKind = "position" | "full-game" | "up-to-here";

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

function buildPgnUpToPly(
  headers: Record<string, string>,
  moves: ParsedPgnMove[],
  upToPly: number,
): string {
  const headerLines = Object.entries(headers)
    .map(([k, v]) => `[${k} "${v.replace(/"/g, '\\"')}"]`)
    .join("\n");
  const truncated = moves.filter((m) => m.ply <= upToPly);
  let text = "";
  for (const m of truncated) {
    if (m.color === "w") text += `${m.moveNumber}. ${m.san} `;
    else text += `${m.san} `;
  }
  return `${headerLines}\n\n${text.trim()} *`;
}

export function SavePositionModal({
  payload,
  chapterId,
  chapterTitle,
  bookTitle,
  onClose,
}: Props) {
  const hasPgn = Boolean(payload.fullPgn && payload.moves && payload.currentPly !== undefined);
  const defaultKind: SaveKind = payload.fen ? "position" : "full-game";

  const [notebooks, setNotebooks] = useState<PositionNotebook[]>(() => readNotebooks());
  const [targetId, setTargetId] = useState(notebooks[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [title, setTitle] = useState(chapterTitle);
  const [tags, setTags] = useState("");
  const [fen, setFen] = useState(payload.fen);
  const [kind, setKind] = useState<SaveKind>(defaultKind);
  const [status, setStatus] = useState("");

  const fenValid = !fen.trim() || isValidFen(fen.trim());

  const pgnPreview: string | undefined = (() => {
    if (!hasPgn) return undefined;
    if (kind === "full-game") return payload.fullPgn;
    if (kind === "up-to-here")
      return buildPgnUpToPly(
        payload.gameHeaders!,
        payload.moves!,
        payload.currentPly!,
      );
    return undefined;
  })();

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

    if (!notebookId) {
      setStatus("Choose or create a notebook first.");
      return;
    }
    if (kind === "position" && !fen.trim()) {
      setStatus("Enter a FEN position.");
      return;
    }

    const savedFen = kind === "position" ? fen.trim() : "";
    const savedPgn = kind === "position" ? undefined : pgnPreview;

    const existing = readNotebookEntries(FEN_NOTEBOOK_KEY);
    const isDup = existing.some(
      (e) =>
        e.notebookId === notebookId &&
        e.chapterId === chapterId &&
        (savedFen ? e.fen === savedFen : e.pgn === savedPgn),
    );
    if (isDup) {
      setStatus("Already saved to this notebook.");
      return;
    }

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
    (kind === "position" && !fen.trim());

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-stone-950/40 p-6">
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-semibold">Save to notebook</h2>
        <p className="mt-1 text-sm text-stone-500">
          Choose what to save, pick a notebook, and add tags.
        </p>

        <div className="mt-5 grid gap-4">
          {hasPgn && (
            <div className="grid gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                What to save
              </label>
              <div className="flex flex-wrap gap-2">
                {(
                  [
                    ["position", "This position (FEN)"],
                    ["up-to-here", `Moves up to here (ply ${payload.currentPly})`],
                    ["full-game", "Full game"],
                  ] as [SaveKind, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => setKind(value)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition ${
                      kind === value
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
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                FEN
              </label>
              <input
                value={fen}
                onChange={(e) => setFen(e.target.value)}
                placeholder="Paste a FEN string…"
                className={`rounded-2xl border px-4 py-3 font-mono text-sm outline-none transition focus:border-stone-900 ${
                  fen && !fenValid ? "border-rose-400 bg-rose-50" : "border-stone-300"
                }`}
              />
              {fen && !fenValid && (
                <p className="text-xs text-rose-600">FEN looks invalid — double-check it.</p>
              )}
            </div>
          )}

          {pgnPreview && (
            <div className="grid gap-1.5">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                PGN preview
              </label>
              <pre className="max-h-28 overflow-auto rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 font-mono text-xs leading-relaxed text-stone-700 whitespace-pre-wrap break-words">
                {pgnPreview}
              </pre>
            </div>
          )}

          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm outline-none transition focus:border-stone-900"
            />
          </div>

          <div className="grid gap-1.5">
            <label className="text-[11px] font-semibold uppercase tracking-wider text-stone-500">
              Notebook
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="rounded-2xl border border-stone-300 px-4 py-3 text-sm outline-none transition focus:border-stone-900"
            >
              <option value="">Choose existing notebook</option>
              {notebooks.map((nb) => (
                <option key={nb.id} value={nb.id}>
                  {nb.name}
                </option>
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
              Tags{" "}
              <span className="normal-case font-normal text-stone-400">
                (comma separated)
              </span>
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
          <p
            className={`mt-3 text-sm ${
              status === "Saved!" ? "text-emerald-700" : "text-rose-600"
            }`}
          >
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
