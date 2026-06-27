import { useEffect, useMemo, useState } from "react";
import { extractFens, FEN_NOTEBOOK_KEY, type NotebookFen } from "@/lib/fen";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export function ChapterChat({
  chapterId,
  chapterTitle,
  bookTitle,
}: {
  chapterId: string;
  chapterTitle: string;
  bookTitle?: string;
}) {
  const [apiKey, setApiKey] = useState("");
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Ask anything about "${chapterTitle}". I will create a ChatPDF source from this chapter when you send your first question.`,
    },
  ]);
  const [sourceId, setSourceId] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const savedKey = window.localStorage.getItem("chatpdf-api-key") || "";
    setApiKey(savedKey);
  }, []);

  const canSend = useMemo(() => Boolean(apiKey.trim() && draft.trim() && !pending), [apiKey, draft, pending]);

  function saveFen(fen: string, sourceMessage: string) {
    try {
      const savedNotebook = window.localStorage.getItem(FEN_NOTEBOOK_KEY);
      const notebook = savedNotebook ? (JSON.parse(savedNotebook) as NotebookFen[]) : [];
      const existing = notebook.find((entry) => entry.fen === fen && entry.chapterId === chapterId);

      if (existing) {
        setStatus("That FEN is already in your notebook.");
        return;
      }

      const entry: NotebookFen = {
        id: `${chapterId}-${Date.now()}-${notebook.length + 1}`,
        fen,
        chapterId,
        chapterTitle,
        bookTitle,
        sourceMessage,
        savedAt: new Date().toISOString(),
      };

      window.localStorage.setItem(FEN_NOTEBOOK_KEY, JSON.stringify([entry, ...notebook]));
      setStatus("FEN saved to notebook.");
    } catch {
      setStatus("Could not save the FEN to notebook.");
    }
  }

  async function ensureSource() {
    if (sourceId) {
      return sourceId;
    }

    const response = await fetch("/api/chatpdf/source", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey, chapterId }),
    });

    const payload = (await response.json()) as { sourceId?: string; error?: string };

    if (!response.ok || !payload.sourceId) {
      throw new Error(payload.error || "Failed to prepare the chapter for chat.");
    }

    setSourceId(payload.sourceId);
    return payload.sourceId;
  }

  async function sendMessage() {
    if (!canSend) return;

    const nextMessages = [...messages, { role: "user" as const, content: draft.trim() }];
    const question = draft.trim();
    setMessages(nextMessages);
    setDraft("");
    setPending(true);
    setStatus("Thinking...");

    try {
      const activeSourceId = await ensureSource();
      const response = await fetch("/api/chatpdf/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          apiKey,
          sourceId: activeSourceId,
          messages: [{ role: "user", content: question }],
        }),
      });

      const payload = (await response.json()) as { content?: string; error?: string };

      if (!response.ok || !payload.content) {
        throw new Error(payload.error || "ChatPDF did not return an answer.");
      }

      setMessages((current) => [...current, { role: "assistant", content: payload.content! }]);
      setStatus("Answer ready.");
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Something went wrong while contacting ChatPDF.",
        },
      ]);
      setStatus("Chat failed.");
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="flex h-full min-h-[36rem] flex-col rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
      <div className="border-b border-stone-200 px-6 py-5">
        <h2 className="text-lg font-semibold tracking-tight">Talk to this chapter</h2>
        <p className="mt-1 text-sm text-stone-500">Paste a ChatPDF API key once and it is saved locally in this browser.</p>
      </div>

      <div className="border-b border-stone-200 px-6 py-4">
        <label className="grid gap-2 text-sm font-medium">
          ChatPDF API key
          <input
            className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
            value={apiKey}
            onChange={(event) => {
              const value = event.target.value;
              setApiKey(value);
              window.localStorage.setItem("chatpdf-api-key", value);
            }}
            placeholder="x-api-key from ChatPDF"
          />
        </label>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
        {messages.map((message, index) => {
          const fens = message.role === "assistant" ? extractFens(message.content) : [];

          return (
            <div key={`${message.role}-${index}`} className={`grid gap-2 ${message.role === "user" ? "justify-items-end" : ""}`}>
              <article
                className={`max-w-[90%] rounded-[1.5rem] px-4 py-3 text-sm leading-7 ${
                  message.role === "user"
                    ? "ml-auto bg-stone-900 text-amber-50"
                    : "bg-stone-100 text-stone-800"
                }`}
              >
                {message.content}
              </article>

              {fens.length > 0 ? (
                <div className="grid w-full max-w-[90%] gap-2 rounded-[1.25rem] border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Detected FENs</p>
                  {fens.map((fen) => (
                    <div key={fen} className="grid gap-2 rounded-[1rem] bg-white p-3">
                      <code className="overflow-x-auto text-xs leading-6 text-stone-700">{fen}</code>
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => saveFen(fen, message.content)}
                          className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                        >
                          Save to notebook
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="border-t border-stone-200 px-6 py-4">
        <div className="grid gap-3">
          <textarea
            rows={4}
            className="rounded-[1.5rem] border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-stone-500 focus:bg-white"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Ask for a summary, test yourself on motifs, or ask for practical plans."
          />
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-stone-500">{status}</span>
            <button
              type="button"
              onClick={sendMessage}
              disabled={!canSend}
              className="rounded-full bg-stone-900 px-5 py-3 text-sm font-semibold text-amber-50 transition hover:bg-stone-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pending ? "Sending..." : "Ask chapter"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
