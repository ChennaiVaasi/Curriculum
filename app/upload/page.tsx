import { UploadForm } from "@/components/upload-form";
import { isR2Configured } from "@/lib/r2";

export default function UploadPage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-6 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">Upload chapters</h1>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-stone-600">
          This uploader is designed for your already-split chapter PDFs. Metadata is applied at upload time, files are stored in Cloudflare R2,
          and the chapter catalog is persisted alongside the app.
        </p>
        <div className="mt-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4 text-sm text-stone-700">
          R2 status:{" "}
          <span className={isR2Configured() ? "font-semibold text-emerald-700" : "font-semibold text-rose-700"}>
            {isR2Configured() ? "configured" : "missing environment variables"}
          </span>
        </div>
      </section>

      <UploadForm />
    </div>
  );
}
