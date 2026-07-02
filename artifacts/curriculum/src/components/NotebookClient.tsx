import { Link } from "wouter";
import { useMemo, useState } from "react";
import { FEN_NOTEBOOK_KEY, notebookEntryToPgn, notebookToPgn } from "@/lib/fen";
import {
  makePositionId,
  readNotebookEntries,
  readNotebooks,
  writeNotebookEntries,
  writeNotebooks,
  type NotebookEntry,
  type PositionNotebook,
} from "@/lib/position-workflow";

export function NotebookClient() {
  const [entries, setEntries] = useState<NotebookEntry[]>(() =>
    readNotebookEntries(FEN_NOTEBOOK_KEY),
  );
  const [notebooks, setNotebooks] = useState<PositionNotebook[]>(() =>
    readNotebooks(),
  );
  const [activeNotebookId, setActiveNotebookId] = useState("all");
  const [newNotebookName, setNewNotebookName] = useState("");
  const [status, setStatus] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const visibleEntries = useMemo(
    () =>
      activeNotebookId === "all"
        ? entries
        : entries.filter((entry) => entry.notebookId === activeNotebookId),
    [activeNotebookId, entries],
  );

  const sortedEntries = useMemo(
    () =>
      [...visibleEntries].sort((left, right) =>
        right.savedAt.localeCompare(left.savedAt),
      ),
    [visibleEntries],
  );

  const allSelected =
    sortedEntries.length > 0 && selected.size === sortedEntries.length;
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

  function persist(next: NotebookEntry[]) {
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
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
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
    setStatus(
      `Downloaded ${sel.length} position${sel.length === 1 ? "" : "s"} as PGN.`,
    );
  }

  async function copySelected() {
    const sel = sortedEntries.filter((e) => selected.has(e.id));
    await navigator.clipboard.writeText(notebookToPgn(sel));
    setStatus(
      `${sel.length} position${sel.length === 1 ? "" : "s"} copied as PGN.`,
    );
  }

  function downloadEntry(entry: NotebookEntry) {
    const safeTitle = (entry.title || entry.chapterTitle)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    downloadFile(
      `${safeTitle || "position"}.pgn`,
      entry.pgn || notebookEntryToPgn(entry),
    );
    setStatus("Position PGN downloaded.");
  }

  function createNotebook() {
    const name = newNotebookName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const next = [
      { id: makePositionId("book"), name, createdAt: now, updatedAt: now },
      ...notebooks,
    ];
    setNotebooks(next);
    writeNotebooks(next);
    setNewNotebookName("");
    setActiveNotebookId(next[0].id);
    setStatus(
      "Notebook created. Use Position Search to add curated positions.",
    );
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Notebooks</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
              Notebooks are curated collections. Create a notebook first, then
              use Position Search to add selected ImportCandidates. Searching
              and importing do not save automatically.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              value={newNotebookName}
              onChange={(e) => setNewNotebookName(e.target.value)}
              placeholder="New notebook name"
              className="rounded-full border border-stone-300 px-4 py-2 text-sm"
            />
            <button
              type="button"
              onClick={createNotebook}
              className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50"
            >
              Create notebook
            </button>
            <Link
              href="/positions"
              className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
            >
              Search positions
            </Link>
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
        {status ? (
          <p className="mt-4 text-sm text-stone-500">{status}</p>
        ) : null}
        <div className="mt-5 flex flex-wrap gap-2 text-sm">
          <button
            type="button"
            onClick={() => setActiveNotebookId("all")}
            className={`rounded-full px-4 py-2 ${activeNotebookId === "all" ? "bg-stone-900 text-amber-50" : "border border-stone-300 text-stone-700"}`}
          >
            All notebooks
          </button>
          {notebooks.map((notebook) => (
            <button
              key={notebook.id}
              type="button"
              onClick={() => setActiveNotebookId(notebook.id)}
              className={`rounded-full px-4 py-2 ${activeNotebookId === notebook.id ? "bg-stone-900 text-amber-50" : "border border-stone-300 text-stone-700"}`}
            >
              {notebook.name}
            </button>
          ))}
        </div>
      </section>

      {sortedEntries.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-7 text-stone-600">
          No notebook entries yet. Create a notebook, import PGN/PDF candidates,
          then add selected positions from Position Search.
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
            <label
              htmlFor="select-all"
              className="cursor-pointer text-sm text-stone-600 select-none"
            >
              {allSelected
                ? "Deselect all"
                : `Select all (${sortedEntries.length})`}
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
                      <span>{entry.title || entry.chapterTitle}</span>
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
                  {entry.chapterId !== "position-search" ? (
                    <Link
                      href={`/chapters/${entry.chapterId}`}
                      className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                    >
                      Open chapter
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeEntry(entry.id)}
                    className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    Remove
                  </button>
                </div>
              </div>
              {entry.tags?.length ? (
                <div className="mt-4 flex flex-wrap gap-2 pl-7">
                  {entry.tags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
