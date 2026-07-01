import { UploadForm } from "@/components/UploadForm";
import { useEffect, useState } from "react";

type ReclassifyResult = {
  updated: number;
  failed: number;
  total: number;
  errors: string[];
};

export default function UploadPage() {
  const [r2Status, setR2Status] = useState<"loading" | "configured" | "missing">("loading");
  const [reclassifying, setReclassifying] = useState(false);
  const [reclassifyResult, setReclassifyResult] = useState<ReclassifyResult | null>(null);
  const [reclassifyError, setReclassifyError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => {
        if (r.ok) setR2Status("configured");
        else setR2Status("missing");
      })
      .catch(() => setR2Status("missing"));
  }, []);

  async function handleReclassifyAll() {
    setReclassifying(true);
    setReclassifyResult(null);
    setReclassifyError(null);
    try {
      const res = await fetch("/api/catalog/reclassify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Reclassify failed");
      setReclassifyResult(data);
    } catch (err: any) {
      setReclassifyError(err?.message || "Unknown error");
    } finally {
      setReclassifying(false);
    }
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">Upload chapters</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
          This uploader is designed for your already-split chapter PDFs. Metadata is applied at upload time and the chapter catalog is updated automatically. Each upload is classified by the taxonomy engine.
        </p>
        {r2Status !== "loading" && (
          <div className="mt-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
            Storage:{" "}
            <span className={r2Status === "configured" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
              {r2Status === "configured" ? "ready" : "not connected"}
            </span>
          </div>
        )}
      </section>

      <UploadForm />

      <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.25)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Classify all existing uploads</h2>
            <p className="mt-1 max-w-xl text-sm text-stone-600">
              Run the taxonomy engine over every chapter already in the catalog. PGN chapters are classified from their stored game text; PDF chapters are downloaded from R2 and classified.
            </p>
          </div>
          <button
            onClick={handleReclassifyAll}
            disabled={reclassifying}
            className="shrink-0 rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {reclassifying ? (
              <span className="flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 16 16" fill="none">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeOpacity="0.3" />
                  <path d="M8 2a6 6 0 0 1 6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                </svg>
                Classifying…
              </span>
            ) : (
              "Classify all uploads"
            )}
          </button>
        </div>

        {reclassifyResult && (
          <div className="mt-5 rounded-[1.5rem] border border-stone-100 bg-stone-50 p-5">
            <div className="flex flex-wrap gap-4">
              <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-5 py-3 text-center">
                <p className="text-2xl font-bold text-emerald-700">{reclassifyResult.updated}</p>
                <p className="mt-0.5 text-xs font-medium text-emerald-600">classified</p>
              </div>
              <div className="rounded-xl bg-stone-100 border border-stone-200 px-5 py-3 text-center">
                <p className="text-2xl font-bold text-stone-700">{reclassifyResult.total}</p>
                <p className="mt-0.5 text-xs font-medium text-stone-500">total</p>
              </div>
              {reclassifyResult.failed > 0 && (
                <div className="rounded-xl bg-rose-50 border border-rose-100 px-5 py-3 text-center">
                  <p className="text-2xl font-bold text-rose-700">{reclassifyResult.failed}</p>
                  <p className="mt-0.5 text-xs font-medium text-rose-600">failed</p>
                </div>
              )}
            </div>

            {reclassifyResult.errors.length > 0 && (
              <details className="mt-4">
                <summary className="cursor-pointer text-xs font-semibold text-stone-500 hover:text-stone-700">
                  {reclassifyResult.errors.length} error{reclassifyResult.errors.length !== 1 ? "s" : ""}
                </summary>
                <ul className="mt-2 grid gap-1 max-h-40 overflow-y-auto pr-1">
                  {reclassifyResult.errors.map((e, i) => (
                    <li key={i} className="rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      {e}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        {reclassifyError && (
          <div className="mt-5 rounded-[1.5rem] border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
            {reclassifyError}
          </div>
        )}
      </section>
    </div>
  );
}
