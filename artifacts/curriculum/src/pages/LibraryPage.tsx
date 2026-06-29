import { Link } from "wouter";
import { useEffect, useState } from "react";
import type { Catalog, ChapterRecord } from "@/lib/types";

export default function LibraryPage() {
  const [catalog, setCatalog] = useState<Catalog>({ books: [], chapters: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState("");
  const [theme, setTheme] = useState("");

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data: Catalog) => setCatalog(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const uniqueLevels = [...new Set(catalog.chapters.map((c) => c.level))].filter(Boolean).sort();
  const uniqueThemes = [...new Set(catalog.chapters.map((c) => c.theme))].filter(Boolean).sort();

  const chapters: ChapterRecord[] = catalog.chapters
    .filter((chapter) => {
      const q = query.toLowerCase().trim();
      const matchesQuery =
        !q ||
        chapter.title.toLowerCase().includes(q) ||
        chapter.theme.toLowerCase().includes(q) ||
        chapter.primarySkill.toLowerCase().includes(q) ||
        chapter.secondarySkills.some((s) => s.toLowerCase().includes(q));
      const matchesLevel = !level || chapter.level === level;
      const matchesTheme = !theme || chapter.theme === theme;
      return matchesQuery && matchesLevel && matchesTheme;
    })
    .sort((a, b) => a.title.localeCompare(b.title));

  // Build a quick bookId → title lookup
  const bookTitle: Record<string, string> = {};
  for (const book of catalog.books) {
    bookTitle[book.id] = book.title;
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
            <p className="mt-2 text-sm text-stone-500">
              Browse all chapters by level, theme, and skill focus.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search chapters, themes, or skills"
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-500 focus:bg-white"
            />
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-500 focus:bg-white"
            >
              <option value="">All levels</option>
              {uniqueLevels.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-500 focus:bg-white"
            >
              <option value="">All themes</option>
              {uniqueThemes.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <button
              onClick={() => { setQuery(""); setLevel(""); setTheme(""); }}
              className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
            >
              Clear
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-[2rem] border border-stone-200 bg-white p-8 text-sm text-stone-500">
          Loading library…
        </section>
      ) : chapters.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-7 text-stone-600">
          No matching chapters yet. Upload chapter PDFs first, or loosen the current filters.
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {chapters.map((chapter) => (
            <Link
              key={chapter.id}
              href={`/chapters/${chapter.id}`}
              className="grid gap-4 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.25)] transition hover:-translate-y-1 hover:border-stone-400"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-600">
                  {chapter.level}
                </span>
                {bookTitle[chapter.bookId] && (
                  <span className="text-xs text-stone-400 truncate max-w-[10rem] text-right">
                    {bookTitle[chapter.bookId]}
                  </span>
                )}
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{chapter.title}</h2>
                <p className="mt-2 text-sm text-stone-600">{chapter.theme}</p>
              </div>
              <div className="rounded-[1.5rem] bg-stone-50 p-4 text-sm text-stone-700">
                Primary skill: <span className="font-medium">{chapter.primarySkill}</span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
