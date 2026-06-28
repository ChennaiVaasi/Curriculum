export default function SettingsPage() {
  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

        <div className="mt-8 grid gap-2">
          <h2 className="text-base font-semibold tracking-tight">ChatPDF</h2>
          <p className="text-sm text-stone-500">
            Your ChatPDF API key is stored as a server secret (<code className="rounded bg-stone-100 px-1 py-0.5 text-xs">CHATPDF_API_KEY</code>).
            To update it, replace the secret in the Replit Secrets panel and restart the server.
          </p>
        </div>

        <div className="mt-10 grid gap-2">
          <h2 className="text-base font-semibold tracking-tight">R2 storage</h2>
          <p className="text-sm text-stone-500">
            Add these as Replit secrets to enable Cloudflare R2 storage. Restart the server after adding them.
          </p>
          <pre className="mt-3 overflow-x-auto rounded-2xl bg-stone-900 p-4 font-mono text-xs text-amber-50">
{`R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET=...
R2_CATALOG_KEY=catalog/catalog.json   # optional
R2_PUBLIC_URL=https://...             # optional`}
          </pre>
        </div>
      </section>
    </div>
  );
}
