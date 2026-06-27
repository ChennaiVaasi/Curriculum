import { Link, useParams } from "wouter";
import { useEffect, useState } from "react";
import type { BookRecord, ChapterRecord } from "@/lib/types";
import { humanBytes } from "@/lib/utils";

type BookResult = {
  book: BookRecord;
  chapters: ChapterRecord[];
};

export default function BookPage() {
  const params = useParams<{ bookId: string }>();
  const [result, setResult] = useState<BookResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetch(`/api/books/${params.bookId}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        const data = await r.json() as BookResult;
        setResult(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.bookId]);

  if (loading) {
    return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  }

  if (notFound || !result) {
    return (
      <div className="rounded-[2rem] border border-stone-200 bg-white p-8">
        <p className="text-stone-600">Book not found.</p>
        <Link href="/library" className="mt-4 inline-block text-sm font-semibold text-stone-900 underline-offset-4 hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  const { book, chapters } = result;

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-stone-500">
          <span>{book.level}</span>
          <span>•</span>
          <span>{book.theme}</span>
          <span>•</span>
          <span>{book.chapterCount} chapters</span>
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">{book.title}</h1>
        <p className="mt-3 text-sm leading-7 text-stone-600">
          Primary skill focus: <span className="font-medium text-stone-900">{book.primarySkill}</span>
        </p>
      </section>

      <section className="grid gap-3">
        {chapters.map((chapter) => (
          <Link
            key={chapter.id}
            href={`/chapters/${chapter.id}`}
            className="grid gap-3 rounded-[1.75rem] border border-stone-200 bg-white px-6 py-5 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.2)] transition hover:border-stone-400 hover:bg-stone-50"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{chapter.title}</h2>
                <p className="mt-1 text-sm text-stone-600">{chapter.primarySkill}</p>
              </div>
              <span className="text-sm text-stone-500">{humanBytes(chapter.fileSize)}</span>
            </div>
            <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-stone-500">
              <span>{chapter.level}</span>
              <span>•</span>
              <span>{chapter.theme}</span>
              {chapter.secondarySkills.length > 0 ? (
                <>
                  <span>•</span>
                  <span>{chapter.secondarySkills.join(", ")}</span>
                </>
              ) : null}
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
