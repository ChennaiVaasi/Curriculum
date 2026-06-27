import { Router } from "express";
import multer from "multer";
import { createAndStoreChapters } from "../lib/catalog.js";
import { isR2Configured, uploadPdfObject } from "../lib/r2.js";
import type { UploadPayload } from "../lib/types.js";
import { makeId, slugify, splitCsv } from "../lib/utils.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.array("files"), async (req, res) => {
  if (!isR2Configured()) {
    res.status(400).json({
      error:
        "Cloudflare R2 is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET to your secrets first.",
    });
    return;
  }

  const payload: UploadPayload = {
    bookTitle: String(req.body.bookTitle || "").trim(),
    level: String(req.body.level || "").trim(),
    theme: String(req.body.theme || "").trim(),
    primarySkill: String(req.body.primarySkill || "").trim(),
    secondarySkills: splitCsv(String(req.body.secondarySkills || "")),
    notes: String(req.body.notes || "").trim(),
  };

  const files = (req.files as Express.Multer.File[]) || [];

  if (!payload.bookTitle || !payload.level || !payload.theme || !payload.primarySkill) {
    res.status(400).json({ error: "Book title, level, theme, and primary skill are required." });
    return;
  }

  if (!files.length) {
    res.status(400).json({ error: "Upload at least one PDF file." });
    return;
  }

  const uploaded: Array<{ filename: string; objectKey: string; fileSize: number }> = [];
  const bookSlug = slugify(payload.bookTitle);

  try {
    for (const file of files) {
      if (file.mimetype !== "application/pdf") {
        res.status(400).json({
          error: `Only PDF uploads are supported. ${file.originalname} is not a PDF.`,
        });
        return;
      }

      const objectKey = `chapters/${bookSlug}/${makeId("pdf")}-${file.originalname}`;
      await uploadPdfObject(objectKey, new Uint8Array(file.buffer), file.originalname);
      uploaded.push({
        filename: file.originalname,
        objectKey,
        fileSize: file.size,
      });
    }

    const result = await createAndStoreChapters(payload, uploaded);

    res.json({
      uploaded: result.records.length,
      bookTitle: result.book.title,
    });
  } catch (err) {
    req.log.error({ err }, "Upload failed");
    res.status(500).json({ error: "Upload failed." });
  }
});

export default router;
