import { useState } from "react";

const defaults = {
  bookTitle: "",
  level: "1400-1700",
  theme: "Middlegame planning",
  primarySkill: "calculation",
  secondarySkills: "pattern recognition, decision making",
  notes: "",
};

export function UploadForm() {
  const [form, setForm] = useState(defaults);
  const [files, setFiles] = useState<File[]>([]);
  const [status, setStatus] = useState<string>("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!files.length) {
      setStatus("Select at least one chapter PDF to upload.");
      return;
    }

    setPending(true);
    setStatus("Uploading chapters to R2...");

    try {
      const body = new FormData();
      body.set("bookTitle", form.bookTitle);
      body.set("level", form.level);
      body.set("theme", form.theme);
      body.set("primarySkill", form.primarySkill);
      body.set("secondarySkills", form.secondarySkills);
      body.set("notes", form.notes);

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

      setStatus(`Uploaded ${payload.uploaded} chapter file(s) for ${payload.bookTitle}.`);
      setFiles([]);
      setForm(defaults);
      const formElement = event.currentTarget;
      formElement.reset();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-6 rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-medium">
          Book title
          <input
            required
            className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
            value={form.bookTitle}
            onChange={(event) => setForm((current) => ({ ...current, bookTitle: event.target.value }))}
            placeholder="Dvoretsky Endgame Manual"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Level band
          <select
            className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
            value={form.level}
            onChange={(event) => setForm((current) => ({ ...current, level: event.target.value }))}
          >
            {["0-800", "800-1200", "1200-1400", "1400-1700", "1700-2000", "2000+"].map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Theme
          <input
            required
            className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
            value={form.theme}
            onChange={(event) => setForm((current) => ({ ...current, theme: event.target.value }))}
            placeholder="Endgame"
          />
        </label>

        <label className="grid gap-2 text-sm font-medium">
          Primary skill
          <input
            required
            className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
            value={form.primarySkill}
            onChange={(event) => setForm((current) => ({ ...current, primarySkill: event.target.value }))}
            placeholder="calculation"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-medium">
        Secondary skills
        <input
          className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
          value={form.secondarySkills}
          onChange={(event) => setForm((current) => ({ ...current, secondarySkills: event.target.value }))}
          placeholder="pattern recognition, technique"
        />
      </label>

      <label className="grid gap-2 text-sm font-medium">
        Notes
        <textarea
          rows={4}
          className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
          value={form.notes}
          onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          placeholder="Optional context that should travel with every uploaded chapter."
        />
      </label>

      <label className="grid gap-2 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm font-medium">
        Chapter PDFs
        <input
          multiple
          accept="application/pdf"
          type="file"
          onChange={(event) => setFiles(Array.from(event.target.files || []))}
        />
        <span className="text-stone-500">
          Upload one or many chapter PDFs. When you upload multiple files, the app uses each filename as the chapter title.
        </span>
        {files.length > 0 ? (
          <span className="text-stone-700">{files.length} file(s) selected</span>
        ) : null}
      </label>

      <div className="flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Uploading..." : "Upload to R2"}
        </button>
        <span className="text-sm text-stone-600">{status}</span>
      </div>
    </form>
  );
}
