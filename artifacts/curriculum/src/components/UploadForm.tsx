import { useState } from "react";
import { useUpload, type UploadMetadata } from "@/context/UploadContext";

const LEVELS = ["0-800", "800-1200", "1200-1400", "1400-1700", "1700-2000", "2000+"];

function bookTitleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const parts = withoutExt.split(/\s+[-–]\s+/);
  const raw = parts.length >= 2 ? parts[0] : withoutExt;
  return raw.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

function chapterTitleFromFilename(filename: string): string {
  const withoutExt = filename.replace(/\.[^.]+$/, "");
  const parts = withoutExt.split(/\s+[-–]\s+/);
  const raw = parts.length >= 2 ? parts.slice(1).join(" - ") : parts[0];
  return raw.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
}

const defaults: UploadMetadata = {
  bookTitle: "",
  level: "1400-1700",
  theme: "",
  primarySkill: "",
  secondarySkills: "",
  notes: "",
  pgn: "",
};

function StatusBadge({ status, progress }: { status: string; progress: number }) {
  if (status === "done") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-700">
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Done
      </span>
    );
  }
  if (status === "error") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-700">
        <svg className="h-3 w-3" viewBox="0 0 12 12" fill="none">
          <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        Error
      </span>
    );
  }
  if (status === "uploading") {
    return (
      <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 12 12" fill="none">
          <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.3" />
          <path d="M6 1.5A4.5 4.5 0 0 1 10.5 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {progress}%
      </span>
    );
  }
  return (
    <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs font-semibold text-stone-500">
      Pending
    </span>
  );
}

export function UploadForm() {
  const { state, startUpload, clearDone } = useUpload();
  const [form, setForm] = useState<UploadMetadata>(defaults);
  const [pickedFiles, setPickedFiles] = useState<File[]>([]);

  const isRunning = state.isRunning;
  const hasActiveJob = state.files.length > 0;

  function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []).filter(
      (f) => f.type === "application/pdf" || f.name.toLowerCase().endsWith(".pdf"),
    );
    setPickedFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...selected.filter((f) => !names.has(f.name))];
    });
    if (selected.length > 0) {
      const parsed = bookTitleFromFilename(selected[0].name);
      setForm((cur) => ({ ...cur, bookTitle: cur.bookTitle || parsed }));
    }
  }

  async function handlePgnFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setForm((cur) => ({ ...cur, pgn: text }));
    event.target.value = "";
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!pickedFiles.length || isRunning) return;
    startUpload(pickedFiles, form);
    setPickedFiles([]);
    setForm(defaults);
  }

  const field = (key: keyof UploadMetadata, value: string) =>
    setForm((cur) => ({ ...cur, [key]: value }));

  const { files: activeFiles, doneCount, errorCount, isRunning: jobRunning } = state;
  const total = activeFiles.length;
  const allDone = hasActiveJob && !jobRunning && doneCount + errorCount === total;
  const overallPct = total > 0 ? Math.round(((doneCount + errorCount) / total) * 100) : 0;

  return (
    <div className="grid gap-6">

      {hasActiveJob && (
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.25)]">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-stone-800">
                {jobRunning
                  ? `Uploading — ${doneCount} of ${total} done`
                  : allDone && errorCount === 0
                    ? `All ${doneCount} file${doneCount !== 1 ? "s" : ""} uploaded successfully`
                    : `Finished — ${doneCount} uploaded, ${errorCount} failed`}
              </p>
              {state.metadata?.bookTitle && (
                <p className="mt-0.5 text-xs text-stone-500">
                  Book: {state.metadata.bookTitle || "auto-detected"}
                </p>
              )}
            </div>
            {allDone && (
              <button
                onClick={clearDone}
                className="shrink-0 rounded-full border border-stone-200 bg-stone-50 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-100"
              >
                Clear
              </button>
            )}
          </div>

          <div className="mb-1 flex items-center justify-between text-xs text-stone-500">
            <span>Overall</span>
            <span className="tabular-nums">{overallPct}%</span>
          </div>
          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-stone-100">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allDone && errorCount === 0
                  ? "bg-emerald-500"
                  : errorCount > 0 && !jobRunning
                    ? "bg-rose-400"
                    : "bg-amber-500"
              }`}
              style={{ width: `${overallPct}%` }}
            />
          </div>

          <ul className="grid gap-2 max-h-72 overflow-y-auto pr-1">
            {activeFiles.map((item) => (
              <li
                key={item.id}
                className={`rounded-xl border px-4 py-3 transition-colors ${
                  item.status === "done"
                    ? "border-emerald-100 bg-emerald-50"
                    : item.status === "error"
                      ? "border-rose-100 bg-rose-50"
                      : item.status === "uploading"
                        ? "border-amber-200 bg-amber-50"
                        : "border-stone-100 bg-stone-50"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm font-medium text-stone-800">
                    {chapterTitleFromFilename(item.name)}
                  </span>
                  <StatusBadge status={item.status} progress={item.progress} />
                </div>
                {item.status === "uploading" && (
                  <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-amber-200">
                    <div
                      className="h-full rounded-full bg-amber-500 transition-all duration-200"
                      style={{ width: `${item.progress}%` }}
                    />
                  </div>
                )}
                {item.status === "error" && item.error && (
                  <p className="mt-1 text-xs text-rose-600">{item.error}</p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <form
        onSubmit={handleSubmit}
        className="grid gap-6 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]"
      >
        <div className="grid gap-3 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-5">
          <p className="text-sm font-medium">Chapter PDFs</p>
          <div className="flex flex-wrap gap-2">
            <label className="cursor-pointer rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100">
              Pick files
              <input
                multiple
                accept="application/pdf"
                type="file"
                className="sr-only"
                onChange={handleFilesChange}
                disabled={isRunning}
              />
            </label>
            <label className="cursor-pointer rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100">
              Browse folder
              <input
                type="file"
                className="sr-only"
                /* @ts-expect-error webkitdirectory is non-standard */
                webkitdirectory=""
                onChange={handleFilesChange}
                disabled={isRunning}
              />
            </label>
            {pickedFiles.length > 0 && (
              <button
                type="button"
                onClick={() => setPickedFiles([])}
                className="rounded-full border border-stone-300 bg-white px-4 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-100"
              >
                Clear all
              </button>
            )}
          </div>
          <p className="text-xs text-stone-500">
            Name files as{" "}
            <code className="rounded bg-stone-200 px-1 py-0.5">Book Title - Chapter Title.pdf</code>{" "}
            — the book is detected per file automatically.
          </p>
        </div>

        {pickedFiles.length > 0 && (
          <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
              {pickedFiles.length} file{pickedFiles.length !== 1 ? "s" : ""} queued
            </p>
            <ul className="grid gap-1.5 max-h-64 overflow-y-auto pr-1">
              {pickedFiles.map((file, i) => (
                <li
                  key={file.name}
                  className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-xl bg-white px-4 py-2.5 text-sm"
                >
                  <span className="truncate font-medium text-stone-800">
                    {chapterTitleFromFilename(file.name)}
                  </span>
                  <span className="whitespace-nowrap text-stone-400">
                    {(file.size / 1024).toFixed(0)} KB
                  </span>
                  <button
                    type="button"
                    aria-label="Remove"
                    onClick={() => setPickedFiles((prev) => prev.filter((_, j) => j !== i))}
                    className="text-stone-400 transition hover:text-stone-700"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-medium md:col-span-2">
            Book title override{" "}
            <span className="font-normal text-stone-400">(optional — leave blank to detect per file)</span>
            <input
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
              value={form.bookTitle}
              onChange={(e) => field("bookTitle", e.target.value)}
              placeholder="Leave blank to use each file's own book name"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Level band
            <select
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
              value={form.level}
              onChange={(e) => field("level", e.target.value)}
            >
              {LEVELS.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Theme
            <input
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
              value={form.theme}
              onChange={(e) => field("theme", e.target.value)}
              placeholder="e.g. Endgame (optional)"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Primary skill
            <input
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
              value={form.primarySkill}
              onChange={(e) => field("primarySkill", e.target.value)}
              placeholder="e.g. calculation (optional)"
            />
          </label>

          <label className="grid gap-2 text-sm font-medium">
            Secondary skills
            <input
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
              value={form.secondarySkills}
              onChange={(e) => field("secondarySkills", e.target.value)}
              placeholder="comma-separated (optional)"
            />
          </label>
        </div>

        <label className="grid gap-2 text-sm font-medium">
          Notes
          <textarea
            rows={3}
            className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
            value={form.notes}
            onChange={(e) => field("notes", e.target.value)}
            placeholder="Optional context that travels with every chapter."
          />
        </label>

        <div className="grid gap-3 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">PGN</p>
              <p className="mt-0.5 text-xs text-stone-500">
                Upload a .pgn file or paste PGN to attach it to every chapter in this upload.
              </p>
            </div>
            <label className="cursor-pointer rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100">
              Upload .pgn
              <input
                type="file"
                accept=".pgn,application/x-chess-pgn,text/plain"
                className="sr-only"
                onChange={handlePgnFileChange}
              />
            </label>
          </div>
          <textarea
            rows={4}
            className="rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3 text-xs leading-6 outline-none transition focus:border-stone-500"
            value={form.pgn}
            onChange={(e) => field("pgn", e.target.value)}
            placeholder={'Paste PGN here, e.g. [Event "Model game"] 1. e4 e5 ...'}
          />
          {form.pgn?.trim() && (
            <button
              type="button"
              onClick={() => field("pgn", "")}
              className="self-start rounded-full border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-100"
            >
              Clear PGN
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <button
            type="submit"
            disabled={isRunning || !pickedFiles.length}
            className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isRunning ? "Upload in progress…" : `Upload${pickedFiles.length > 0 ? ` ${pickedFiles.length} file${pickedFiles.length !== 1 ? "s" : ""}` : ""}`}
          </button>
          {isRunning && (
            <span className="text-sm text-stone-500">
              You can navigate away — the upload will continue.
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
