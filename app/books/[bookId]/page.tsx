import Link from "next/link";
import { notFound } from "next/navigation";

import { getBookById } from "@/lib/catalog";
import { humanBytes } from "@/lib/utils";

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const result = await getBookById(bookId);

  if (!result) {
    notFound();
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
