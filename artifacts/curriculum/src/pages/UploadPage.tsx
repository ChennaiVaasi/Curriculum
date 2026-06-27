import { UploadForm } from "@/components/UploadForm";
import { useEffect, useState } from "react";

export default function UploadPage() {
  const [r2Status, setR2Status] = useState<"loading" | "configured" | "missing">("loading");

  useEffect(() => {
    fetch("/api/catalog")
      .then((r) => {
        if (r.ok) setR2Status("configured");
        else setR2Status("missing");
      })
      .catch(() => setR2Status("missing"));
  }, []);

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">Upload chapters</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
          This uploader is designed for your already-split chapter PDFs. Metadata is applied at upload time, files are stored in Cloudflare R2,
          and the chapter catalog is persisted alongside the app.
        </p>
        {r2Status !== "loading" && (
          <div className="mt-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
            R2 status:{" "}
            <span className={r2Status === "configured" ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
              {r2Status === "configured" ? "configured" : "missing environment variables"}
            </span>
          </div>
        )}
      </section>

      <UploadForm />
    </div>
  );
}
