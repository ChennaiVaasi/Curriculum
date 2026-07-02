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

export type SavePositionPayload = {
  fen: string;
  pgn?: string;
  sourceMessage: string;
};

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

export function SavePositionModal({ payload, chapterId, chapterTitle, bookTitle, onClose }: Props) {
  const [notebooks, setNotebooks] = useState<PositionNotebook[]>(() => readNotebooks());
  const [targetId, setTargetId] = useState(notebooks[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [title, setTitle] = useState(chapterTitle);
  const [tags, setTags] = useState("");
  const [fen, setFen] = useState(payload.fen);
  const [status, setStatus] = useState("");

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
    if (!fen.trim()) {
      setStatus("Enter a FEN position.");
      return;
    }

    const existing = readNotebookEntries(FEN_NOTEBOOK_KEY);
    const isDup = existing.some(
      (e) => e.notebookId === notebookId && e.fen === fen.trim() && e.chapterId === chapterId,
    );
    if (isDup) {
      setStatus("Already saved to this notebook.");
      return;
    }

    const entry: NotebookEntry = {
      id: makePositionId("entry"),
      notebookId,
      title: title.trim() || chapterTitle,
      fen: fen.trim(),
      pgn: payload.pgn,
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
    setTimeout(onClose, 800);
  }

  const fenValid = !fen.trim() || isValidFen(fen.trim());

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-stone-950/40 p-6">
      <div className="w-full max-w-lg rounded-[2rem] bg-white p-6 shadow-2xl">
        <h2 className="text-xl font-semibold">Save position to notebook</h2>
        <p className="mt-1 text-sm text-stone-500">
          Choose a notebook and optionally add tags before saving.
        </p>

        <div className="mt-5 grid gap-3">
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
            disabled={!fen.trim() || (!targetId && !newName.trim())}
            className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:opacity-40"
          >
            Save to notebook
          </button>
        </div>
      </div>
    </div>
  );
}
