import { useState, useCallback, useRef } from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { FEN_NOTEBOOK_KEY, type NotebookFen } from "@/lib/fen";
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

type ScannedFen = { fen: string; copied: boolean };

type Props = {
  url: string;
  title?: string;
  chapterId?: string;
  chapterTitle?: string;
  bookTitle?: string;
};

export function PdfViewer({ url, title, chapterId, chapterTitle, bookTitle }: Props) {
  const [numPages, setNumPages] = useState<number>(0);
  const [page, setPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanStatus, setScanStatus] = useState("");
  const [scannedFens, setScannedFens] = useState<ScannedFen[]>([]);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const onLoadSuccess = useCallback(({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPage(1);
    setError(null);
    setScannedFens([]);
    setScanStatus("");
  }, []);

  const onLoadError = useCallback((err: Error) => {
    setError(err.message);
  }, []);

  async function scanPage() {
    const canvas = canvasRef.current;
    if (!canvas) {
      setScanStatus("Page not ready — try again in a moment.");
      return;
    }

    setScanning(true);
    setScanStatus("Scanning page for chess positions…");
    setScannedFens([]);

    try {
      const imageBase64 = canvas.toDataURL("image/png").replace(/^data:image\/png;base64,/, "");

      const response = await fetch("/api/chess-eye/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64, mimeType: "image/png" }),
      });

      const payload = (await response.json()) as { positions?: Array<{ fen: string }>; error?: string };

      if (!response.ok) {
        setScanStatus(payload.error ?? "Scan failed.");
        return;
      }

      const fens = (payload.positions ?? []).map((p) => p.fen).filter(Boolean);
      if (fens.length === 0) {
        setScanStatus("No chess positions found on this page.");
      } else {
        setScanStatus(`Found ${fens.length} position${fens.length === 1 ? "" : "s"}.`);
        setScannedFens(fens.map((fen) => ({ fen, copied: false })));
      }
    } catch {
      setScanStatus("Scan failed — check your connection.");
    } finally {
      setScanning(false);
    }
  }

  function copyFen(index: number) {
    const entry = scannedFens[index];
    if (!entry) return;
    navigator.clipboard.writeText(entry.fen).then(() => {
      setScannedFens((prev) =>
        prev.map((f, i) => (i === index ? { ...f, copied: true } : f))
      );
      setTimeout(() => {
        setScannedFens((prev) =>
          prev.map((f, i) => (i === index ? { ...f, copied: false } : f))
        );
      }, 1500);
    });
  }

  function saveFenToNotebook(fen: string) {
    if (!chapterId || !chapterTitle) return;
    try {
      const saved = window.localStorage.getItem(FEN_NOTEBOOK_KEY);
      const notebook = saved ? (JSON.parse(saved) as NotebookFen[]) : [];
      if (notebook.find((e) => e.fen === fen && e.chapterId === chapterId)) {
        setScanStatus("That FEN is already in your notebook.");
        return;
      }
      const entry: NotebookFen = {
        id: `${chapterId}-scan-${Date.now()}`,
        fen,
        chapterId,
        chapterTitle,
        bookTitle,
        sourceMessage: `Scanned from page ${page}`,
        savedAt: new Date().toISOString(),
      };
      window.localStorage.setItem(FEN_NOTEBOOK_KEY, JSON.stringify([entry, ...notebook]));
      setScanStatus("FEN saved to notebook.");
    } catch {
      setScanStatus("Could not save to notebook.");
    }
  }

  const pageControls = (border: "top" | "bottom") =>
    numPages > 1 ? (
      <div className={`flex items-center justify-between px-5 py-3 text-sm ${border === "top" ? "border-b" : "border-t"} border-stone-200`}>
        <button
          className="rounded-lg px-3 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
          onClick={() => { setPage((p) => Math.max(1, p - 1)); setScannedFens([]); setScanStatus(""); }}
          disabled={page <= 1}
        >
          ← Prev
        </button>
        <span className="text-stone-500">Page {page} of {numPages}</span>
        <button
          className="rounded-lg px-3 py-1 text-stone-600 hover:bg-stone-100 disabled:opacity-40"
          onClick={() => { setPage((p) => Math.min(numPages, p + 1)); setScannedFens([]); setScanStatus(""); }}
          disabled={page >= numPages}
        >
          Next →
        </button>
      </div>
    ) : null;

  if (error) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-stone-500">
        Failed to load PDF: {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {pageControls("top")}

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
            canvasRef={canvasRef}
            className="mx-auto shadow-sm"
            width={Math.min(typeof window !== "undefined" ? window.innerWidth - 64 : 800, 900)}
          />
        </Document>
      </div>

      {pageControls("bottom")}

      <div className="border-t border-stone-200 px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={scanPage}
            disabled={scanning || numPages === 0}
            className="rounded-full border border-stone-300 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-400 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scanning ? "Scanning…" : "Scan page for positions"}
          </button>
          {scanStatus && (
            <span className="text-sm text-stone-500">{scanStatus}</span>
          )}
        </div>

        {scannedFens.length > 0 && (
          <div className="mt-4 grid gap-2">
            {scannedFens.map((entry, index) => (
              <div key={index} className="grid gap-2 rounded-[1.25rem] border border-stone-200 bg-stone-50 p-4">
                <code className="overflow-x-auto text-xs leading-6 text-stone-700">{entry.fen}</code>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => copyFen(index)}
                    className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                  >
                    {entry.copied ? "Copied!" : "Copy FEN"}
                  </button>
                  {chapterId && chapterTitle && (
                    <button
                      type="button"
                      onClick={() => saveFenToNotebook(entry.fen)}
                      className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                    >
                      Save to notebook
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
