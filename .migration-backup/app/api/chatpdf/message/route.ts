import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as {
    apiKey?: string;
    sourceId?: string;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  const apiKey = body.apiKey?.trim();
  const sourceId = body.sourceId?.trim();
  const messages = body.messages || [];

  if (!apiKey || !sourceId || !messages.length) {
    return NextResponse.json({ error: "apiKey, sourceId, and at least one message are required." }, { status: 400 });
  }

  const response = await fetch("https://api.chatpdf.com/v1/chats/message", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({
      sourceId,
      messages,
    }),
  });

  const payload = (await response.json()) as { content?: string; message?: string };

  if (!response.ok || !payload.content) {
    return NextResponse.json(
      {
        error: payload.message || "ChatPDF did not return a response.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ content: payload.content });
}
