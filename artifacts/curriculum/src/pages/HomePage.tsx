import { Link } from "wouter";
import { useEffect, useState } from "react";
import type { Catalog } from "@/lib/types";
import { humanBytes } from "@/lib/utils";

export default function HomePage() {
  const [catalog, setCatalog] = useState<Catalog>({ books: [], chapters: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => r.json())
      .then((data: Catalog) => setCatalog(data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const totalBytes = catalog.chapters.reduce((sum, chapter) => sum + chapter.fileSize, 0);
  const recentChapters = [...catalog.chapters]
    .sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt))
    .slice(0, 6);

  return (
    <div className="grid gap-8">
      <section className="grid gap-6 rounded-[2.5rem] bg-stone-900 px-8 py-10 text-amber-50 shadow-[0_32px_80px_-36px_rgba(28,25,23,0.65)] lg:grid-cols-[1.35fr_0.9fr]">
        <div className="space-y-5">
          <span className="inline-flex rounded-full border border-amber-200/20 px-3 py-1 text-xs uppercase tracking-[0.25em] text-amber-200/80">
            Chess chapter browser
          </span>
          <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
            Upload chapter PDFs, browse them by level and theme, and talk to one chapter at a time.
          </h1>
          <p className="max-w-2xl text-base leading-8 text-amber-50/75">
            This workspace is built for your split chess curriculum. Each chapter becomes a searchable study object with metadata,
            an embedded PDF reader, and a ChatPDF-backed discussion panel.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/upload" className="rounded-full bg-amber-200 px-5 py-3 text-sm font-semibold text-stone-900 transition hover:bg-amber-100">
              Upload chapters
            </Link>
            <Link href="/library" className="rounded-full border border-amber-50/20 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:bg-white/10">
              Browse library
            </Link>
          </div>
        </div>

        <div className="grid gap-4 rounded-[2rem] bg-white/6 p-5">
          {[
            { label: "Books", value: loading ? "…" : String(catalog.books.length) },
            { label: "Chapters", value: loading ? "…" : String(catalog.chapters.length) },
            { label: "Storage tracked", value: loading ? "…" : humanBytes(totalBytes) },
          ].map((item) => (
            <div key={item.label} className="rounded-[1.5rem] border border-white/10 bg-black/15 p-4">
              <p className="text-sm text-amber-50/60">{item.label}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight">{item.value}</p>
            </div>
          ))}
          <div className="rounded-[1.5rem] border border-dashed border-white/15 p-4 text-sm leading-7 text-amber-50/70">
            ChatPDF keys are entered inside the app and stay in your browser. PDFs are served securely through the app.
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-2xl font-semibold tracking-tight">Recent chapters</h2>
              <p className="mt-1 text-sm text-stone-500">Fresh uploads appear here so you can jump back into curation quickly.</p>
            </div>
            <Link href="/library" className="text-sm font-semibold text-stone-700 underline-offset-4 hover:underline">
              Open full library
            </Link>
          </div>

          {!loading && recentChapters.length === 0 ? (
            <div className="mt-8 rounded-[1.5rem] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm leading-7 text-stone-600">
              No chapters yet. Go to Upload and start uploading your split PDFs.
            </div>
          ) : (
            <div className="mt-6 grid gap-3">
              {recentChapters.map((chapter) => (
                <Link
                  key={chapter.id}
                  href={`/chapters/${chapter.id}`}
                  className="grid gap-2 rounded-[1.5rem] border border-stone-200 px-5 py-4 transition hover:border-stone-400 hover:bg-stone-50"
                >
                  <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-stone-500">
                    <span>{chapter.level}</span>
                    <span>•</span>
                    <span>{chapter.theme}</span>
                  </div>
                  <p className="text-lg font-semibold tracking-tight">{chapter.title}</p>
                  <p className="text-sm text-stone-600">{chapter.primarySkill}</p>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
            <h2 className="text-xl font-semibold tracking-tight">How uploads work</h2>
            <ol className="mt-4 grid gap-3 text-sm leading-7 text-stone-600">
              <li>1. Pick a book title and shared metadata like level, theme, and primary skill.</li>
              <li>2. Drop one or many split chapter PDFs into the uploader.</li>
              <li>3. The app stores the PDFs and updates the chapter catalog.</li>
              <li>4. Each chapter becomes readable and chat-ready from the library.</li>
            </ol>
          </article>

          <article className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
            <h2 className="text-xl font-semibold tracking-tight">Recommended next step</h2>
            <p className="mt-4 text-sm leading-7 text-stone-600">
              Start by uploading one clean batch from your verified chapter splits so you can test the reader, metadata flow, and ChatPDF answers before loading the full library.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
