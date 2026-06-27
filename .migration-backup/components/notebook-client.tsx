"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { FEN_NOTEBOOK_KEY, notebookEntryToPgn, notebookToPgn, type NotebookFen } from "@/lib/fen";

export function NotebookClient() {
  const [entries, setEntries] = useState<NotebookFen[]>(() => {
    if (typeof window === "undefined") {
      return [];
    }

    try {
      const saved = window.localStorage.getItem(FEN_NOTEBOOK_KEY);
      return saved ? (JSON.parse(saved) as NotebookFen[]) : [];
    } catch {
      return [];
    }
  });
  const [status, setStatus] = useState("");

  const sortedEntries = useMemo(
    () => [...entries].sort((left, right) => right.savedAt.localeCompare(left.savedAt)),
    [entries],
  );

  function persist(next: NotebookFen[]) {
    setEntries(next);
    window.localStorage.setItem(FEN_NOTEBOOK_KEY, JSON.stringify(next));
  }

  async function copyFen(fen: string) {
    await navigator.clipboard.writeText(fen);
    setStatus("FEN copied.");
  }

  function removeEntry(id: string) {
    persist(entries.filter((entry) => entry.id !== id));
    setStatus("Entry removed.");
  }

  function clearAll() {
    persist([]);
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
            </p>
          </div>
          {entries.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={downloadNotebook}
                className="rounded-full bg-stone-900 px-4 py-2 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
              >
                Download PGN
              </button>
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
          {sortedEntries.map((entry) => (
            <article
              key={entry.id}
              className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.25)]"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
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
                <div className="flex flex-wrap gap-2">
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
              <p className="mt-4 text-sm leading-7 text-stone-600">{entry.sourceMessage}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
