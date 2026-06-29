import { useEffect, useMemo, useState } from "react";
import { extractFens, FEN_NOTEBOOK_KEY, type NotebookFen } from "@/lib/fen";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Provider = "chat2pdf" | "chatpdf";

export function ChapterChat({
  chapterId,
  chapterTitle,
  bookTitle,
}: {
  chapterId: string;
  chapterTitle: string;
  bookTitle?: string;
}) {
  const [provider, setProvider] = useState<Provider>("chat2pdf");
  const [chat2pdfAvailable, setChat2pdfAvailable] = useState<boolean | null>(null);
  const [chatpdfAvailable, setChatpdfAvailable] = useState<boolean | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Ask anything about "${chapterTitle}". I'll prepare this chapter for chat when you send your first question.`,
    },
  ]);
  const [sourceId, setSourceId] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");
  const [copiedFens, setCopiedFens] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetch("/api/chat2pdf/status")
      .then((r) => r.json())
      .then((data: { configured?: boolean }) => {
        const available = Boolean(data.configured);
        setChat2pdfAvailable(available);
        if (!available) setProvider("chatpdf");
      })
      .catch(() => {
        setChat2pdfAvailable(false);
        setProvider("chatpdf");
      });

    fetch("/api/chatpdf/status")
      .then((r) => r.json())
      .then((data: { configured?: boolean }) => {
        setChatpdfAvailable(Boolean(data.configured));
      })
      .catch(() => setChatpdfAvailable(false));
  }, []);

  const canSend = useMemo(() => {
    if (pending) return false;
    if (!draft.trim()) return false;
    return true;
  }, [pending, draft]);

  function copyFen(fen: string) {
    navigator.clipboard.writeText(fen).then(() => {
      setCopiedFens((prev) => ({ ...prev, [fen]: true }));
      setTimeout(() => setCopiedFens((prev) => ({ ...prev, [fen]: false })), 1500);
    });
  }

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

  async function ensureSource(currentSourceId: string) {
    if (currentSourceId) return currentSourceId;

    const endpoint = provider === "chat2pdf" ? "/api/chat2pdf/source" : "/api/chatpdf/source";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chapterId }),
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

    const question = draft.trim();
    const nextMessages = [...messages, { role: "user" as const, content: question }];
    setMessages(nextMessages);
    setDraft("");
    setPending(true);
    setStatus("Preparing chapter…");

    try {
      const activeSourceId = await ensureSource(sourceId);

      setStatus("Thinking…");

      const endpoint = provider === "chat2pdf" ? "/api/chat2pdf/message" : "/api/chatpdf/message";
      const body = {
        sourceId: activeSourceId,
        messages: nextMessages
          .filter((m) => m.role === "user" || m.role === "assistant")
          .map((m) => ({ role: m.role, content: m.content })),
      };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const payload = (await response.json()) as { content?: string; error?: string };

      if (!response.ok || !payload.content) {
        throw new Error(payload.error || "The provider did not return an answer.");
      }

      setMessages((current) => [...current, { role: "assistant", content: payload.content! }]);
      setStatus("Answer ready.");
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          content: error instanceof Error ? error.message : "Something went wrong.",
        },
      ]);
      setStatus("Chat failed.");
    } finally {
      setPending(false);
    }
  }

  function handleProviderChange(next: Provider) {
    setProvider(next);
    setSourceId("");
    setMessages([
      {
        role: "assistant",
        content: `Ask anything about "${chapterTitle}". I'll prepare this chapter for chat when you send your first question.`,
      },
    ]);
    setStatus("");
  }

  const showProviderBar =
    chat2pdfAvailable !== null &&
    chatpdfAvailable !== null &&
    (chat2pdfAvailable || chatpdfAvailable);

  return (
    <section className="flex h-full min-h-[36rem] flex-col rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
      <div className="border-b border-stone-200 px-6 py-5">
        <h2 className="text-lg font-semibold tracking-tight">Talk to this chapter</h2>
        <p className="mt-1 text-sm text-stone-500">Ask questions, get summaries, or test yourself on the material.</p>
      </div>

      {showProviderBar && (
        <div className="border-b border-stone-200 px-6 py-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-400">Provider</p>
          <div className="flex gap-2">
            {chat2pdfAvailable && (
              <button
                type="button"
                onClick={() => handleProviderChange("chat2pdf")}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  provider === "chat2pdf"
                    ? "border-stone-900 bg-stone-900 text-amber-50"
                    : "border-stone-300 text-stone-600 hover:border-stone-400"
                }`}
              >
                Chat2PDF
              </button>
            )}
            {chatpdfAvailable && (
              <button
                type="button"
                onClick={() => handleProviderChange("chatpdf")}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  provider === "chatpdf"
                    ? "border-stone-900 bg-stone-900 text-amber-50"
                    : "border-stone-300 text-stone-600 hover:border-stone-400"
                }`}
              >
                ChatPDF
              </button>
            )}
          </div>
        </div>
      )}

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

              {fens.length > 0 && (
                <div className="grid w-full max-w-[90%] gap-2 rounded-[1.25rem] border border-stone-200 bg-stone-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">Detected FENs</p>
                  {fens.map((fen) => (
                    <div key={fen} className="grid gap-2 rounded-[1rem] bg-white p-3">
                      <code className="overflow-x-auto text-xs leading-6 text-stone-700">{fen}</code>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => copyFen(fen)}
                          className="rounded-full border border-stone-300 px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-100"
                        >
                          {copiedFens[fen] ? "Copied!" : "Copy FEN"}
                        </button>
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
              )}
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
            onKeyDown={(event) => {
              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
                sendMessage();
              }
            }}
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
              {pending ? "Sending…" : "Ask chapter"}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
