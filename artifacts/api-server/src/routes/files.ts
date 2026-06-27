import { Router } from "express";
import { getChapterById } from "../lib/catalog.js";
import { getBinaryObject } from "../lib/r2.js";

const router = Router();

router.get("/files/:chapterId", async (req, res) => {
  try {
    const result = await getChapterById(req.params.chapterId);

    if (!result) {
      res.status(404).send("Chapter not found.");
      return;
    }

    const file = await getBinaryObject(result.chapter.objectKey);
    const arrayBuffer = file.bytes.buffer.slice(
      file.bytes.byteOffset,
      file.bytes.byteOffset + file.bytes.byteLength,
    ) as ArrayBuffer;

    res.setHeader("Content-Type", file.contentType);
    res.setHeader(
      "Content-Disposition",
      `inline; filename="${result.chapter.originalFilename}"`,
    );
    res.setHeader("Cache-Control", "private, max-age=300");
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    req.log.error({ err }, "Failed to serve file");
    res.status(500).send("Failed to serve file.");
  }
});

export default router;
