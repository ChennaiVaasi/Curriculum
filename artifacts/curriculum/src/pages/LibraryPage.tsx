import { Link } from "wouter";
import { useEffect, useState } from "react";
import type { Catalog } from "@/lib/types";

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

  const uniqueLevels = [...new Set(catalog.books.map((b) => b.level))].sort();
  const uniqueThemes = [...new Set(catalog.books.map((b) => b.theme))].sort();

  const books = catalog.books
    .filter((book) => {
      const q = query.toLowerCase().trim();
      const matchesQuery =
        !q ||
        book.title.toLowerCase().includes(q) ||
        book.theme.toLowerCase().includes(q) ||
        book.primarySkill.toLowerCase().includes(q);
      const matchesLevel = !level || book.level === level;
      const matchesTheme = !theme || book.theme === theme;
      return matchesQuery && matchesLevel && matchesTheme;
    })
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Library</h1>
            <p className="mt-2 text-sm text-stone-500">Browse the uploaded chapter collection by level, theme, and skill focus.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search books, themes, or skills"
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
      ) : books.length === 0 ? (
        <section className="rounded-[2rem] border border-dashed border-stone-300 bg-stone-50 p-8 text-sm leading-7 text-stone-600">
          No matching books yet. Upload a batch of chapter PDFs first, or loosen the current filters.
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {books.map((book) => (
            <Link
              key={book.id}
              href={`/books/${book.id}`}
              className="grid gap-4 rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.25)] transition hover:-translate-y-1 hover:border-stone-400"
            >
              <div className="flex items-center justify-between gap-4">
                <span className="rounded-full bg-stone-100 px-3 py-1 text-xs uppercase tracking-[0.2em] text-stone-600">
                  {book.level}
                </span>
                <span className="text-xs text-stone-500">{book.chapterCount} chapters</span>
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{book.title}</h2>
                <p className="mt-2 text-sm text-stone-600">{book.theme}</p>
              </div>
              <div className="rounded-[1.5rem] bg-stone-50 p-4 text-sm text-stone-700">
                Primary skill: <span className="font-medium">{book.primarySkill}</span>
              </div>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
