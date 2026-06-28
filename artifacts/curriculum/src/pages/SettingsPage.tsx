import { useEffect, useState } from "react";

const CHATPDF_KEY = "chatpdf-api-key";

export default function SettingsPage() {
  const [chatpdfKey, setChatpdfKey] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setChatpdfKey(window.localStorage.getItem(CHATPDF_KEY) || "");
  }, []);

  function saveKey() {
    window.localStorage.setItem(CHATPDF_KEY, chatpdfKey.trim());
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function clearKey() {
    window.localStorage.removeItem(CHATPDF_KEY);
    setChatpdfKey("");
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-[2rem] border border-stone-200 bg-white p-8 shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>

        <div className="mt-8 grid gap-2">
          <h2 className="text-base font-semibold tracking-tight">ChatPDF API key</h2>
          <p className="text-sm text-stone-500">
            Your key is stored in this browser only — never sent to the server.
            Get one at{" "}
            <a
              href="https://www.chatpdf.com/api"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2 hover:text-stone-800"
            >
              chatpdf.com/api
            </a>
            .
          </p>
          <div className="mt-3 flex gap-3">
            <input
              type="password"
              className="flex-1 rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-500 focus:bg-white"
              value={chatpdfKey}
              onChange={(e) => setChatpdfKey(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") saveKey(); }}
              placeholder="x-api-key from chatpdf.com"
            />
            <button
              type="button"
              onClick={saveKey}
              className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:bg-stone-700"
            >
              {saved ? "Saved!" : "Save"}
            </button>
            {chatpdfKey && (
              <button
                type="button"
                onClick={clearKey}
                className="rounded-full border border-stone-300 px-5 py-3 text-sm font-semibold text-stone-600 transition hover:border-stone-400 hover:bg-stone-50"
              >
                Clear
              </button>
            )}
          </div>
        </div>

        <div className="mt-10 grid gap-2">
          <h2 className="text-base font-semibold tracking-tight">R2 storage secrets</h2>
          <p className="text-sm text-stone-500">
            Add these as Replit secrets on the server to enable Cloudflare R2 storage.
            Restart the server after adding them.
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
