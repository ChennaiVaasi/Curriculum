import { useState } from "react";

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

const defaults = {
  bookTitle: "",
  level: "1400-1700",
  theme: "",
  primarySkill: "",
  secondarySkills: "",
  notes: "",
  pgn: "",
};

export function UploadForm() {
  const [form, setForm] = useState(defaults);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string>("");
  const [pending, setPending] = useState(false);

  function handleFilesChange(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files || []);
    setFiles(selected);

    if (selected.length > 0) {
      const parsed = bookTitleFromFilename(selected[0].name);
      setForm((current) => ({
        ...current,
        bookTitle: current.bookTitle || parsed,
      }));
    }
  }

  async function handlePgnFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setForm((current) => ({ ...current, pgn: text }));
    event.target.value = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!files.length) {
      setStatus("Select at least one chapter PDF to upload.");
      return;
    }

    setPending(true);
    setStatus("Uploading...");
    const formElement = event.currentTarget;

    try {
      const body = new FormData();
      body.set("bookTitle", form.bookTitle);
      body.set("level", form.level);
      body.set("theme", form.theme);
      body.set("primarySkill", form.primarySkill);
      body.set("secondarySkills", form.secondarySkills);
      body.set("notes", form.notes);
      body.set("pgn", form.pgn);

      for (const file of files) {
        body.append("files", file);
      }

      const response = await fetch("/api/upload", {
        method: "POST",
        body,
      });

      const payload = (await response.json()) as { error?: string; uploaded?: number; bookTitle?: string };

      if (!response.ok) {
        throw new Error(payload.error || "Upload failed.");
      }

      setStatus(`Uploaded ${payload.uploaded} chapter file(s) for "${payload.bookTitle}".`);
      setFiles([]);
      setForm(defaults);
      formElement.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  const field = (key: keyof typeof form, value: string) =>
    setForm((current) => ({ ...current, [key]: value }));

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">

      <label className="grid gap-2 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm font-medium">
        Chapter PDFs
        <input
          multiple
          accept="application/pdf"
          type="file"
          onChange={handleFilesChange}
        />
        <span className="text-stone-500">
          Each file becomes its own chapter. Name files as{" "}
          <code className="rounded bg-stone-200 px-1 py-0.5 text-xs">Book Title - Chapter Title.pdf</code>{" "}
          and the book is detected per file automatically.
        </span>
      </label>

      {files.length > 0 && (
        <div className="rounded-[1.5rem] border border-stone-200 bg-stone-50 px-5 py-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">
            {files.length} file{files.length !== 1 ? "s" : ""} selected
          </p>
          <ul className="grid gap-1.5">
            {files.map((file) => (
              <li key={file.name} className="grid grid-cols-[1fr_auto] gap-4 rounded-xl bg-white px-4 py-2.5 text-sm">
                <span className="truncate font-medium text-stone-800">{chapterTitleFromFilename(file.name)}</span>
                <span className="whitespace-nowrap text-stone-400">{(file.size / 1024).toFixed(0)} KB</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium md:col-span-2">
          Book title override <span className="font-normal text-stone-400">(optional — leave blank to detect per file)</span>
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
            {LEVELS.map((option) => (
              <option key={option} value={option}>{option}</option>
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
            <p className="mt-0.5 text-xs text-stone-500">Upload a .pgn file or paste PGN to attach it to every chapter in this upload.</p>
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
          disabled={pending || !files.length}
          className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Uploading..." : "Upload"}
        </button>
        {status && <span className="text-sm text-stone-600">{status}</span>}
      </div>
    </form>
  );
}
