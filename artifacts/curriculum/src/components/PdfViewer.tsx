import { useState, useCallback } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type Props = {
  url: string;
  title?: string;
};

export function PdfViewer({ url, title }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPage(1);
    setError(null);
  }, []);

  const onLoadError = useCallback((err: Error) => {
    setError(err.message);
  }, []);

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-stone-500">
        Failed to load PDF: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {numPages > 1 && (
        <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3 text-sm">
          <button
            className="rounded-lg px-3 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← Prev
          </button>
          <span className="text-stone-500">
            Page {page} of {numPages}
          </span>
          <button
            className="rounded-lg px-3 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
          >
            Next →
          </button>
        </div>
      )}
      <div className="overflow-auto bg-stone-100">
        <Document
          file={url}
          onLoadSuccess={onLoadSuccess}
          onLoadError={onLoadError}
          loading={
            <div className="flex h-64 items-center justify-center text-sm text-stone-500">
              Loading PDF…
            </div>
          }
        >
          <Page
            pageNumber={page}
            renderTextLayer
            renderAnnotationLayer
            className="mx-auto shadow-sm"
            width={Math.min(typeof window !== "undefined" ? window.innerWidth - 64 : 800, 900)}
          />
        </Document>
      </div>
      {numPages > 1 && (
        <div className="flex items-center justify-between border-t border-stone-200 px-5 py-3 text-sm">
          <button
            className="rounded-lg px-3 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            ← Prev
          </button>
          <span className="text-stone-500">
            Page {page} of {numPages}
          </span>
          <button
            className="rounded-lg px-3 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
            onClick={() => setPage((p) => Math.min(numPages, p + 1))}
            disabled={page >= numPages}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
