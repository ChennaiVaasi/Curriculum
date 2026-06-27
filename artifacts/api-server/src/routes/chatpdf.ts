import { Router } from "express";
import { getChapterById } from "../lib/catalog.js";
import { getBinaryObject } from "../lib/r2.js";

const router = Router();

router.post("/chatpdf/source", async (req, res) => {
  const { apiKey, chapterId } = req.body as { apiKey?: string; chapterId?: string };

  if (!apiKey?.trim() || !chapterId?.trim()) {
    res.status(400).json({ error: "apiKey and chapterId are required." });
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

    const response = await fetch("https://api.chatpdf.com/v1/sources/add-file", {
      method: "POST",
      headers: { "x-api-key": apiKey.trim() },
      body: formData,
    });

    const payload = (await response.json()) as { sourceId?: string; message?: string };

    if (!response.ok || !payload.sourceId) {
      res.status(400).json({
        error: payload.message || "ChatPDF could not ingest the selected chapter.",
      });
      return;
    }

    res.json({ sourceId: payload.sourceId });
  } catch (err) {
    req.log.error({ err }, "ChatPDF source creation failed");
    res.status(500).json({ error: "Failed to create ChatPDF source." });
  }
});

router.post("/chatpdf/message", async (req, res) => {
  const { apiKey, sourceId, messages } = req.body as {
    apiKey?: string;
    sourceId?: string;
    messages?: Array<{ role: "user" | "assistant"; content: string }>;
  };

  if (!apiKey?.trim() || !sourceId?.trim() || !messages?.length) {
    res.status(400).json({
      error: "apiKey, sourceId, and at least one message are required.",
    });
    return;
  }

  try {
    const response = await fetch("https://api.chatpdf.com/v1/chats/message", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
      },
      body: JSON.stringify({ sourceId: sourceId.trim(), messages }),
    });

    const payload = (await response.json()) as { content?: string; message?: string };

    if (!response.ok || !payload.content) {
      res.status(400).json({
        error: payload.message || "ChatPDF did not return a response.",
      });
      return;
    }

    res.json({ content: payload.content });
  } catch (err) {
    req.log.error({ err }, "ChatPDF message failed");
    res.status(500).json({ error: "Failed to send message to ChatPDF." });
  }
});

export default router;
