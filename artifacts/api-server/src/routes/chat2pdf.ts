import { Router } from "express";
import { getChapterById } from "../lib/catalog.js";
import { getBinaryObject } from "../lib/r2.js";

const router = Router();

function getApiKey(): string | null {
  return process.env.CHAT2PDF_API_KEY?.trim() || null;
}

router.get("/chat2pdf/status", (_req, res) => {
  res.json({ configured: Boolean(getApiKey()) });
});

router.post("/chat2pdf/source", async (req, res) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    res.status(503).json({ error: "Chat2PDF is not configured on this server." });
    return;
  }

  const { chapterId } = req.body as { chapterId?: string };

  if (!chapterId?.trim()) {
    res.status(400).json({ error: "chapterId is required." });
    return;
  }

  try {
    const result = await getChapterById(chapterId.trim());

    if (!result) {
      res.status(404).json({ error: "Chapter not found." });
      return;
    }

    const file = await getBinaryObject(result.chapter.objectKey);
    const arrayBuffer = file.bytes.buffer.slice(
      file.bytes.byteOffset,
      file.bytes.byteOffset + file.bytes.byteLength,
    ) as ArrayBuffer;

    const formData = new FormData();
    formData.set(
      "file",
      new Blob([arrayBuffer], { type: "application/pdf" }),
      result.chapter.originalFilename,
    );

    const response = await fetch("https://api.chat2pdf.com/v1/sources/add-file", {
      method: "POST",
      headers: { "x-api-key": apiKey },
      body: formData,
    });

    const payload = (await response.json()) as { sourceId?: string; message?: string };

    if (!response.ok || !payload.sourceId) {
      res.status(400).json({
        error: payload.message || "Chat2PDF could not ingest the selected chapter.",
      });
      return;
    }

    res.json({ sourceId: payload.sourceId });
  } catch (err) {
    req.log.error({ err }, "Chat2PDF source creation failed");
    res.status(500).json({ error: "Failed to create Chat2PDF source." });
  }
});

router.post("/chat2pdf/message", async (req, res) => {
  const apiKey = getApiKey();

  if (!apiKey) {
    res.status(503).json({ error: "Chat2PDF is not configured on this server." });
    return;
  }

  const { sourceId, messages } = req.body as {
    sourceId?: string;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!sourceId?.trim() || !messages?.length) {
    res.status(400).json({ error: "sourceId and at least one message are required." });
    return;
  }

  try {
    const response = await fetch("https://api.chat2pdf.com/v1/chats/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify({ sourceId: sourceId.trim(), messages }),
    });

    const payload = (await response.json()) as { content?: string; message?: string };

    if (!response.ok || !payload.content) {
      res.status(400).json({
        error: payload.message || "Chat2PDF did not return a response.",
      });
      return;
    }

    res.json({ content: payload.content });
  } catch (err) {
    req.log.error({ err }, "Chat2PDF message failed");
    res.status(500).json({ error: "Failed to send message to Chat2PDF." });
  }
});

export default router;
