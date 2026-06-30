import { Link } from "wouter";
import { useMemo, useState } from "react";
import { FEN_NOTEBOOK_KEY, notebookEntryToPgn, notebookToPgn, type NotebookFen } from "@/lib/fen";

export function NotebookClient() {
  const [entries, setEntries] = useState<NotebookFen[]>(() => {
    try {
      const saved = window.localStorage.getItem(FEN_NOTEBOOK_KEY);
      return saved ? (JSON.parse(saved) as NotebookFen[]) : [];
    } catch {
      return [];
    }
  });
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sortedEntries = useMemo(
    () => [...entries].sort((left, right) => right.savedAt.localeCompare(left.savedAt)),
    [entries],
  );

  const allSelected = sortedEntries.length > 0 && selected.size === sortedEntries.length;
  const someSelected = selected.size > 0;

  function toggleEntry(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(sortedEntries.map((e) => e.id)));
    }
  }

  function persist(next: NotebookFen[]) {
    setEntries(next);
    window.localStorage.setItem(FEN_NOTEBOOK_KEY, JSON.stringify(next));
  }

  async function copyFen(fen: string) {
    await navigator.clipboard.writeText(fen);
    setStatus("FEN copied.");
  }

  async function copyNotebookPgn() {
    await navigator.clipboard.writeText(notebookToPgn(sortedEntries));
    setStatus("All positions copied as PGN.");
  }

  function removeEntry(id: string) {
    persist(entries.filter((entry) => entry.id !== id));
    setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
    setStatus("Entry removed.");
  }

  function clearAll() {
    persist([]);
    setSelected(new Set());
    setStatus("Notebook cleared.");
  }

  function downloadFile(filename: string, contents: string) {
    const blob = new Blob([contents], { type: "application/x-chess-pgn" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadNotebook() {
    downloadFile("fen-notebook.pgn", notebookToPgn(sortedEntries));
    setStatus("Notebook PGN downloaded.");
  }

  function downloadSelected() {
    const sel = sortedEntries.filter((e) => selected.has(e.id));
    downloadFile(`positions-${sel.length}.pgn`, notebookToPgn(sel));
    setStatus(`Downloaded ${sel.length} position${sel.length === 1 ? "" : "s"} as PGN.`);
  }

  async function copySelected() {
    const sel = sortedEntries.filter((e) => selected.has(e.id));
    await navigator.clipboard.writeText(notebookToPgn(sel));
    setStatus(`${sel.length} position${sel.length === 1 ? "" : "s"} copied as PGN.`);
  }

  function downloadEntry(entry: NotebookFen) {
    const safeChapter = entry.chapterTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    downloadFile(`${safeChapter || "chapter"}-position.pgn`, notebookEntryToPgn(entry));
    setStatus("Position PGN downloaded.");
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">FEN notebook</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
              Save positions directly from chapter chat replies, then come back here to copy, review, or reopen the source chapter.
              Select multiple entries to export them as a PGN database.
            </p>
          </div>
          {entries.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {someSelected ? (
                <>
                  <button
                    type="button"
                    onClick={copySelected}
                    className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
                  >
                    Copy {selected.size} as PGN
                  </button>
                  <button
                    type="button"
                    onClick={downloadSelected}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    Download {selected.size} as PGN
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={copyNotebookPgn}
                    className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
                  >
                    Copy PGN
                  </button>
                  <button
                    type="button"
                    onClick={downloadNotebook}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    Download PGN
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={clearAll}
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
              >
                Clear notebook
              </button>
            </div>
          ) : null}
        </div>
        {status ? <p className="mt-4 text-sm text-stone-500">{status}</p> : null}
      </section>

      {sortedEntries.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-7 text-stone-600">
          No saved FENs yet. Ask a chapter for a position, then use the save action that appears beneath the chat answer.
        </section>
      ) : (
        <section className="grid gap-4">
          <div className="flex items-center gap-3 px-2">
            <input
              id="select-all"
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="h-4 w-4 cursor-pointer accent-stone-900"
            />
            <label htmlFor="select-all" className="cursor-pointer text-sm text-stone-600 select-none">
              {allSelected ? "Deselect all" : `Select all (${sortedEntries.length})`}
            </label>
          </div>

          {sortedEntries.map((entry) => (
            <article
              key={entry.id}
              onClick={() => toggleEntry(entry.id)}
              className={`rounded-[2rem] border bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.25)] cursor-pointer transition ${
                selected.has(entry.id)
                  ? "border-stone-900 ring-1 ring-stone-900"
                  : "border-stone-200 hover:border-stone-400"
              }`}
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={selected.has(entry.id)}
                    onChange={() => toggleEntry(entry.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 cursor-pointer accent-stone-900 shrink-0"
                  />
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-500">
                      {entry.bookTitle ? <span>{entry.bookTitle}</span> : null}
                      {entry.bookTitle ? <span>-</span> : null}
                      <span>{entry.chapterTitle}</span>
                    </div>
                    <pre className="overflow-x-auto rounded-[1.25rem] bg-stone-900 px-4 py-3 font-mono text-xs leading-6 text-amber-50">
                      {entry.fen}
                    </pre>
                  </div>
                </div>
                <div
                  className="flex flex-wrap gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => copyFen(entry.fen)}
                    className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
                  >
                    Copy FEN
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadEntry(entry)}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    Download PGN
                  </button>
                  <Link
                    href={`/chapters/${entry.chapterId}`}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    Open chapter
                  </Link>
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
              <p className="mt-4 pl-7 text-sm leading-7 text-stone-600">{entry.sourceMessage}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
