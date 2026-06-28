import { useEffect, useMemo, useState } from "react";
import { extractFens, FEN_NOTEBOOK_KEY, type NotebookFen } from "@/lib/fen";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

type Provider = "chat2pdf" | "chatpdf";

type PgnTrace = {
  gameTitles: string[];
  gameCount: number;
  setupPositionCount: number;
};

function parsePgnTagValue(game: string, tagName: string) {
  const match = game.match(new RegExp(`^\\[${tagName}\\s+"((?:\\\\.|[^"\\\\])*)"\\]`, "m"));
  return match?.[1]?.replace(/\\"/g, '"').replace(/\\\\/g, "\\").trim() || "";
}

function splitPgnGames(pgn: string) {
  const normalized = pgn.replace(/\r\n?/g, "\n").trim();
  if (!normalized) return [];

  const headerStarts = [...normalized.matchAll(/^\[(?:Event|White)\s+"/gm)].map((match) => match.index || 0);
  const gameStarts = headerStarts.filter((start, index) => index === 0 || normalized.slice(headerStarts[index - 1], start).trim().includes("\n\n"));

  if (gameStarts.length > 0) {
    return gameStarts.map((start, index) => normalized.slice(start, gameStarts[index + 1] ?? normalized.length).trim()).filter(Boolean);
  }

  return [normalized];
}

function getPgnGameTitle(game: string, fileName?: string) {
  const event = parsePgnTagValue(game, "Event");
  if (event && event !== "?") return event;

  const white = parsePgnTagValue(game, "White");
  const black = parsePgnTagValue(game, "Black");
  if (white && black && white !== "?" && black !== "?") return `${white} vs ${black}`;

  return fileName?.trim() || "Untitled PGN";
}

function parsePgnTrace(pgn: string, fileName?: string): PgnTrace {
  const games = splitPgnGames(pgn);
  const setupPositionCount = (pgn.match(/^\[FEN\s+"/gm) || []).length;

  return {
    gameTitles: games.map((game) => getPgnGameTitle(game, fileName)),
    gameCount: games.length,
    setupPositionCount,
  };
}

function withPgnContext(question: string, pgn: string) {
  const trimmedPgn = pgn.trim();
  if (!trimmedPgn) return question;

  return `${question}\n\nPGN context:\n${trimmedPgn}`;
}

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
  const [chatpdfKey, setChatpdfKey] = useState("");
  const [draft, setDraft] = useState("");
  const [pgnContext, setPgnContext] = useState("");
  const [pgnFileName, setPgnFileName] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: "assistant",
      content: `Ask anything about "${chapterTitle}". I'll prepare this chapter for chat when you send your first question.`,
    },
  ]);
  const [sourceId, setSourceId] = useState("");
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState("");

  useEffect(() => {
    const savedKey = window.localStorage.getItem("chatpdf-api-key") || "";
    setChatpdfKey(savedKey);

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
  }, []);

  const apiKey = provider === "chatpdf" ? chatpdfKey : "";
  const pgnTrace = useMemo(() => parsePgnTrace(pgnContext, pgnFileName), [pgnContext, pgnFileName]);
  const canSend = useMemo(() => {
    if (pending) return false;
    if (!draft.trim()) return false;
    if (provider === "chatpdf" && !chatpdfKey.trim()) return false;
    return true;
  }, [pending, draft, provider, chatpdfKey]);

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
    const body =
      provider === "chat2pdf"
        ? { chapterId }
        : { apiKey, chapterId };

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
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
    const messageContent = withPgnContext(question, pgnContext);
    const nextMessages = [...messages, { role: "user" as const, content: question }];
    setMessages(nextMessages);
    setDraft("");
    setPending(true);
    setStatus("Preparing chapter…");

    try {
      const activeSourceId = await ensureSource(sourceId);

      setStatus("Thinking…");

      const endpoint = provider === "chat2pdf" ? "/api/chat2pdf/message" : "/api/chatpdf/message";
      const body =
        provider === "chat2pdf"
          ? { sourceId: activeSourceId, messages: [{ role: "user", content: messageContent }] }
          : { apiKey, sourceId: activeSourceId, messages: [{ role: "user", content: messageContent }] };

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

  return (
    <section className="flex h-full min-h-[36rem] flex-col rounded-[2rem] border border-stone-200 bg-white shadow-[0_24px_60px_-32px_rgba(41,37,36,0.35)]">
      <div className="border-b border-stone-200 px-6 py-5">
        <h2 className="text-lg font-semibold tracking-tight">Talk to this chapter</h2>
        <p className="mt-1 text-sm text-stone-500">Ask questions, get summaries, or test yourself on the material.</p>
      </div>

      {chat2pdfAvailable !== null && (
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
          </div>
        </div>
      )}

      {provider === "chatpdf" && (
        <div className="border-b border-stone-200 px-6 py-4">
          <label className="grid gap-2 text-sm font-medium">
            ChatPDF API key
            <input
              className="rounded-2xl border border-stone-300 bg-stone-50 px-4 py-3 outline-none transition focus:border-stone-500 focus:bg-white"
              value={chatpdfKey}
              onChange={(event) => {
                const value = event.target.value;
                setChatpdfKey(value);
                window.localStorage.setItem("chatpdf-api-key", value);
              }}
              placeholder="x-api-key from chatpdf.com"
            />
          </label>
        </div>
      )}

      {provider === "chat2pdf" && (
        <div className="border-b border-stone-200 px-6 py-3">
          <p className="text-xs text-stone-400">Using Chat2PDF — no API key required.</p>
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
          <div className="grid gap-3 rounded-[1.5rem] border border-stone-200 bg-stone-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-stone-500">PGN context</p>
                <p className="mt-1 text-xs text-stone-500">Upload a .pgn file or paste PGN to include it with your chapter question.</p>
              </div>
              <label className="cursor-pointer rounded-full border border-stone-300 bg-white px-3 py-2 text-xs font-semibold text-stone-700 transition hover:bg-stone-100">
                Upload .pgn
                <input
                  type="file"
                  accept=".pgn,application/x-chess-pgn,text/plain"
                  className="sr-only"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;

                    setPgnFileName(file.name);
                    setPgnContext(await file.text());
                    event.target.value = "";
                  }}
                />
              </label>
            </div>
            <textarea
              rows={3}
              className="rounded-[1.25rem] border border-stone-300 bg-white px-4 py-3 text-xs leading-6 outline-none transition focus:border-stone-500"
              value={pgnContext}
              onChange={(event) => {
                setPgnContext(event.target.value);
                if (!event.target.value.trim()) setPgnFileName("");
              }}
              placeholder={'Paste PGN here, for example: [Event "Model game"] ...'}
            />
            <div className="rounded-[1.25rem] border border-stone-200 bg-white p-3 text-xs text-stone-600">
              <div className="mb-2 flex flex-wrap gap-3 font-semibold text-stone-700">
                <span>PGN Trace</span>
                <span>{pgnTrace.gameCount} game{pgnTrace.gameCount === 1 ? "" : "s"}</span>
                <span>{pgnTrace.setupPositionCount} setup position{pgnTrace.setupPositionCount === 1 ? "" : "s"}</span>
              </div>
              {pgnTrace.gameTitles.length > 0 ? (
                <ol className="list-decimal space-y-1 pl-4">
                  {pgnTrace.gameTitles.map((title, index) => (
                    <li key={`${title}-${index}`} className="truncate">
                      {title}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-stone-400">No PGN detected yet.</p>
              )}
            </div>
          </div>
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
