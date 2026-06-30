import { Router } from "express";
import multer from "multer";
import {
  createChapterRecord,
  getCatalog,
  saveCatalog,
  upsertBook,
} from "../lib/catalog.js";
import { isR2Configured, uploadPgnObject } from "../lib/r2.js";
import type { UploadPayload } from "../lib/types.js";
import { makeId, slugify, splitCsv } from "../lib/utils.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function safeObjectFilename(filename: string) {
  return filename
    .replace(/[/\\]/g, "-")
    .replace(/[\u0000-\u001f\u007f]+/g, "")
    .trim();
}

function isPgnFile(file: Express.Multer.File) {
  return /\.pgn$/i.test(file.originalname) || file.mimetype === "application/x-chess-pgn";
}

router.post("/upload-pgn", upload.array("files"), async (req, res) => {
  if (!isR2Configured()) {
    res.status(400).json({
      error:
        "Cloudflare R2 is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET to your secrets first.",
    });
    return;
  }

  const files = (req.files as Express.Multer.File[]) || [];

  if (!files.length) {
    res.status(400).json({ error: "Upload at least one PGN file." });
    return;
  }

  const bookTitle = String(req.body.bookTitle || "").trim();
  if (!bookTitle) {
    res.status(400).json({ error: "bookTitle is required for PGN uploads." });
    return;
  }

  for (const file of files) {
    if (!isPgnFile(file)) {
      res.status(400).json({
        error: `Only .pgn files are accepted. "${file.originalname}" is not a PGN file.`,
      });
      return;
    }
  }

  const basePayload: Omit<UploadPayload, "pgn"> = {
    bookTitle,
    level: String(req.body.level || "").trim() || "1400-1700",
    theme: String(req.body.theme || "").trim() || "General",
    primarySkill: String(req.body.primarySkill || "").trim() || "general",
    secondarySkills: splitCsv(String(req.body.secondarySkills || "")),
    notes: String(req.body.notes || "").trim(),
  };

  try {
    const bookSlug = slugify(bookTitle);
    const catalog = await getCatalog();
    const book = await upsertBook(catalog, { ...basePayload, pgn: "" });

    for (const file of files) {
      const pgnText = file.buffer.toString("utf8");
      const objectFilename =
        safeObjectFilename(file.originalname) || `${makeId("pgn")}.pgn`;
      const objectKey = `pgn/${bookSlug}/${makeId("pgn")}-${objectFilename}`;

      await uploadPgnObject(objectKey, pgnText, file.originalname);

      const record = createChapterRecord(
        book,
        { ...basePayload, pgn: pgnText },
        file.originalname,
        objectKey,
        file.size,
        "pgn",
      );
      catalog.chapters.push(record);
    }

    book.chapterCount = catalog.chapters.filter(
      (entry) => entry.bookId === book.id,
    ).length;
    book.updatedAt = new Date().toISOString();

    await saveCatalog(catalog);

    res.json({ uploaded: files.length, bookTitle: book.title });
  } catch (err) {
    req.log.error({ err }, "PGN upload failed");
    res.status(500).json({ error: "PGN upload failed." });
  }
});

export default router;
