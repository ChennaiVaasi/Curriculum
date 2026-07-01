import { Link } from "wouter";
import type { ReactNode } from "react";
import { useUpload } from "@/context/UploadContext";

function GlobalUploadBar() {
  const { state, clearDone } = useUpload();
  const { files, isRunning, doneCount, errorCount } = state;

  if (files.length === 0) return null;

  const total = files.length;
  const pct = Math.round(((doneCount + errorCount) / total) * 100);
  const uploading = files.find((f) => f.status === "uploading");
  const allDone = !isRunning && doneCount + errorCount === total;

  return (
    <div
      className={`border-b px-6 py-2 text-xs transition-colors ${
        allDone && errorCount === 0
          ? "border-emerald-200 bg-emerald-50"
          : errorCount > 0 && !isRunning
            ? "border-rose-200 bg-rose-50"
            : "border-amber-200 bg-amber-50"
      }`}
    >
      <div className="mx-auto flex max-w-7xl items-center gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span
              className={`font-semibold ${
                allDone && errorCount === 0
                  ? "text-emerald-800"
                  : errorCount > 0 && !isRunning
                    ? "text-rose-800"
                    : "text-amber-900"
              }`}
            >
              {isRunning
                ? uploading
                  ? `Uploading ${doneCount + 1} of ${total}: ${uploading.name}`
                  : `Starting…`
                : allDone && errorCount === 0
                  ? `✓ ${doneCount} file${doneCount !== 1 ? "s" : ""} uploaded`
                  : `${doneCount} uploaded, ${errorCount} failed`}
            </span>
            <span className="shrink-0 tabular-nums text-stone-500">
              {doneCount + errorCount}/{total}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-200/60">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                allDone && errorCount === 0
                  ? "bg-emerald-500"
                  : errorCount > 0 && !isRunning
                    ? "bg-rose-400"
                    : "bg-amber-500"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
          {uploading && (
            <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-stone-200/40">
              <div
                className="h-full rounded-full bg-amber-400/70 transition-all duration-200"
                style={{ width: `${uploading.progress}%` }}
              />
            </div>
          )}
        </div>

        {allDone && (
          <button
            onClick={clearDone}
            className="shrink-0 rounded-full px-3 py-1 text-xs font-semibold text-stone-500 transition hover:bg-stone-200/60 hover:text-stone-700"
          >
            Dismiss
          </button>
        )}
      </div>
    </div>
  );
}

export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f2ebdc_0%,#f8f4ec_32%,#fbfaf7_100%)] text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-stone-900 text-sm font-semibold text-amber-100">
              64
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight">Curriculum</p>
              <p className="text-sm text-stone-500">Chess chapter library and study desk</p>
            </div>
          </Link>

          <nav className="flex items-center gap-3 text-sm">
            <Link className="rounded-full px-4 py-2 text-stone-700 transition hover:bg-stone-100" href="/library">
              Library
            </Link>
            <Link className="rounded-full px-4 py-2 text-stone-700 transition hover:bg-stone-100" href="/notebook">
              Notebook
            </Link>
            <Link className="rounded-full px-4 py-2 text-stone-700 transition hover:bg-stone-100" href="/upload">
              Upload
            </Link>
            <Link className="rounded-full px-4 py-2 text-stone-700 transition hover:bg-stone-100" href="/pgn-taxonomy">
              PGN Taxonomy
            </Link>
          </nav>
        </div>
        <GlobalUploadBar />
      </header>
      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-8">{children}</main>
    </div>
  );
}
