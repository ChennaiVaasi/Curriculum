export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-3 max-w-3xl text-sm leading-7 text-stone-600">
          Cloudflare R2 credentials live as secrets on the server. ChatPDF API keys are intentionally not stored on the server:
          users paste a key directly in the chapter chat panel and it stays in that browser's local storage.
        </p>
        <div className="mt-6 grid gap-4 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-5 text-sm leading-7 text-stone-700">
          <p>Add these secrets to your Replit project to enable R2 storage:</p>
          <pre className="overflow-x-auto rounded-2xl bg-stone-900 p-4 font-mono text-xs text-amber-50">
{`R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_CATALOG_KEY=catalog/catalog.json`}
          </pre>
          <p>
            After adding the secrets, restart the server. Use the Upload page to add chapter PDFs.
            When you open a chapter, the reader streams the PDF through the app and the
            chat panel can send that single PDF to ChatPDF on demand.
          </p>
        </div>
      </section>
    </div>
  );
}
