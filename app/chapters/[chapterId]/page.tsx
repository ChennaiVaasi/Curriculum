import Link from "next/link";
import { notFound } from "next/navigation";

import { ChapterChat } from "@/components/chapter-chat";
import { getChapterById } from "@/lib/catalog";
import { humanBytes } from "@/lib/utils";

export default async function ChapterPage({
  params,
}: {
  params: Promise<{ chapterId: string }>;
}) {
  const { chapterId } = await params;
  const result = await getChapterById(chapterId);

  if (!result) {
    notFound();
  }

  const { chapter, book, siblings } = result;

  return (
    <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="grid gap-6">
        <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
          <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-stone-500">
            {book ? <Link href={`/books/${book.id}`}>{book.title}</Link> : <span>Unknown book</span>}
            <span>-</span>
            <span>{chapter.level}</span>
            <span>-</span>
            <span>{chapter.theme}</span>
          </div>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight">{chapter.title}</h1>
          <div className="mt-4 grid gap-3 text-sm text-stone-600 md:grid-cols-3">
            <div className="rounded-[1.25rem] bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Primary skill</p>
              <p className="mt-2 font-medium text-stone-900">{chapter.primarySkill}</p>
            </div>
            <div className="rounded-[1.25rem] bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">Secondary skills</p>
              <p className="mt-2 font-medium text-stone-900">{chapter.secondarySkills.join(", ") || "None"}</p>
            </div>
            <div className="rounded-[1.25rem] bg-stone-50 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-stone-500">File size</p>
              <p className="mt-2 font-medium text-stone-900">{humanBytes(chapter.fileSize)}</p>
            </div>
          </div>
          {chapter.notes ? <p className="mt-5 text-sm leading-7 text-stone-600">{chapter.notes}</p> : null}
        </section>

        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
          <div className="border-b border-stone-200 px-6 py-5">
            <h2 className="text-lg font-semibold tracking-tight">Chapter reader</h2>
            <p className="mt-1 text-sm text-stone-500">The PDF streams from private R2 storage through the app.</p>
          </div>
          <iframe title={chapter.title} src={`/api/files/${chapter.id}`} className="h-[70vh] w-full bg-stone-100" />
        </section>
      </div>

      <div className="grid gap-6">
        <ChapterChat chapterId={chapter.id} chapterTitle={chapter.title} bookTitle={book?.title} />

        <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
          <h2 className="text-lg font-semibold tracking-tight">More from this book</h2>
          <div className="mt-4 grid gap-2">
            {siblings
              .filter((entry) => entry.id !== chapter.id)
              .slice(0, 8)
              .map((entry) => (
                <Link
                  key={entry.id}
                  href={`/chapters/${entry.id}`}
                  className="rounded-[1.25rem] border border-stone-200 px-4 py-3 text-sm text-stone-700 transition hover:border-stone-400 hover:bg-stone-50"
                >
                  {entry.title}
                </Link>
              ))}
          </div>
        </section>
      </div>
    </div>
  );
}
