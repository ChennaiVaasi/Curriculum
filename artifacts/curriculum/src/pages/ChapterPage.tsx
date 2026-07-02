import { Link, useParams } from "wouter";
import { useEffect, useState } from "react";
import type { BookRecord, ChapterRecord } from "@/lib/types";
import { humanBytes } from "@/lib/utils";
import { ChapterChat } from "@/components/ChapterChat";
import { PdfViewer } from "@/components/PdfViewer";
import { PgnViewer } from "@/components/PgnViewer";
import { SavePositionModal, type SavePositionPayload } from "@/components/SavePositionModal";

type ChapterResult = {
  chapter: ChapterRecord;
  book: BookRecord | null;
  siblings: ChapterRecord[];
};

export default function ChapterPage() {
  const params = useParams<{ chapterId: string }>();
  const [result, setResult] = useState<ChapterResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [savePayload, setSavePayload] = useState<SavePositionPayload | null>(null);

  useEffect(() => {
    fetch(`/api/chapters/${params.chapterId}`)
      .then(async (r) => {
        if (r.status === 404) { setNotFound(true); return; }
        const data = await r.json() as ChapterResult;
        setResult(data);
      })
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));
  }, [params.chapterId]);

  if (loading) {
    return <div className="p-8 text-sm text-stone-500">Loading…</div>;
  }

  if (notFound || !result) {
    return (
      <div className="rounded-[2rem] border border-stone-200 bg-white p-8">
        <p className="text-stone-600">Chapter not found.</p>
        <Link href="/library" className="mt-4 inline-block text-sm font-semibold text-stone-900 underline-offset-4 hover:underline">
          Back to library
        </Link>
      </div>
    );
  }

  const { chapter, book, siblings } = result;
  const isPgn = chapter.fileType === "pgn";

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-stone-500">
          {book ? <Link href={`/books/${book.id}`}>{book.title}</Link> : <span>Unknown book</span>}
          <span>-</span>
          <span>{chapter.level}</span>
          <span>-</span>
          <span>{chapter.theme}</span>
          <span>-</span>
          <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${isPgn ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
            {isPgn ? "PGN" : "PDF"}
          </span>
        </div>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">{chapter.title}</h1>
        <div className="mt-4 grid gap-3 text-sm text-stone-600 sm:grid-cols-3">
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

      {isPgn ? (
        <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
          <div className="border-b border-stone-200 px-6 py-5">
            <h2 className="text-lg font-semibold tracking-tight">PGN Viewer</h2>
            <p className="mt-1 text-sm text-stone-500">Game notation stored with this chapter.</p>
          </div>
          <PgnViewer
            pgn={chapter.pgn}
            chapterId={chapter.id}
            chapterTitle={chapter.title}
            bookTitle={book?.title}
            onSavePosition={setSavePayload}
          />
        </section>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <section className="overflow-hidden rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
            <div className="border-b border-stone-200 px-6 py-5">
              <h2 className="text-lg font-semibold tracking-tight">Chapter reader</h2>
              <p className="mt-1 text-sm text-stone-500">PDFs are served securely through the app.</p>
            </div>
            <PdfViewer
              url={`/api/files/${chapter.id}`}
              title={chapter.title}
              chapterId={chapter.id}
              chapterTitle={chapter.title}
              bookTitle={book?.title}
            />
            <div className="border-t border-stone-100 px-6 py-4">
              <button
                onClick={() =>
                  setSavePayload({ fen: "", sourceMessage: `From chapter: ${chapter.title}` })
                }
                className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:bg-stone-50"
              >
                Save a position to notebook
              </button>
            </div>
          </section>
          <div className="sticky top-6 h-fit">
            <ChapterChat key={chapter.id} chapterId={chapter.id} chapterTitle={chapter.title} bookTitle={book?.title} />
          </div>
        </div>
      )}

      {savePayload && (
        <SavePositionModal
          payload={savePayload}
          chapterId={chapter.id}
          chapterTitle={chapter.title}
          bookTitle={book?.title}
          onClose={() => setSavePayload(null)}
        />
      )}
    </div>
  );
}
