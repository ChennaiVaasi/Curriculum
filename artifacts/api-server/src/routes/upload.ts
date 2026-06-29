import { Router } from "express";
import multer from "multer";
import { createAndStoreChapters } from "../lib/catalog.js";
import { isR2Configured, uploadPdfObject } from "../lib/r2.js";
import type { UploadPayload } from "../lib/types.js";
import { bookTitleFromFilename, makeId, slugify, splitCsv } from "../lib/utils.js";

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

function hasPdfExtension(filename: string) {
  return /\.pdf$/i.test(filename);
}

function hasPdfSignature(buffer: Buffer) {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function isPdfUpload(file: Express.Multer.File) {
  return (
    file.mimetype === "application/pdf" ||
    (hasPdfExtension(file.originalname) && hasPdfSignature(file.buffer))
  );
}

function safeObjectFilename(filename: string) {
  return filename
    .replace(/[/\\]/g, "-")
    .replace(/[\u0000-\u001f\u007f]+/g, "")
    .trim();
}

router.post("/upload", upload.array("files"), async (req, res) => {
  if (!isR2Configured()) {
    res.status(400).json({
      error:
        "Cloudflare R2 is not configured. Add R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET to your secrets first.",
    });
    return;
  }

  const files = (req.files as Express.Multer.File[]) || [];

  if (!files.length) {
    res.status(400).json({ error: "Upload at least one PDF file." });
    return;
  }

  const globalBookTitleOverride = String(req.body.bookTitle || "").trim();
  const basePayload: Omit<UploadPayload, "bookTitle"> = {
    level: String(req.body.level || "").trim() || "1400-1700",
    theme: String(req.body.theme || "").trim() || "General",
    primarySkill: String(req.body.primarySkill || "").trim() || "general",
    secondarySkills: splitCsv(String(req.body.secondarySkills || "")),
    notes: String(req.body.notes || "").trim(),
    pgn: String(req.body.pgn || "").trim(),
  };

  try {
    for (const file of files) {
      if (!isPdfUpload(file)) {
        res.status(400).json({
          error: `Only PDF uploads are supported. ${file.originalname} was received as ${file.mimetype || "an unknown file type"}.`,
        });
        return;
      }
    }

    // Upload all files to R2 first, tagging each with its derived book title
    const uploaded: Array<{
      filename: string;
      objectKey: string;
      fileSize: number;
      derivedBookTitle: string;
    }> = [];

    for (const file of files) {
      const derivedBookTitle =
        globalBookTitleOverride || bookTitleFromFilename(file.originalname);
      const bookSlug = slugify(derivedBookTitle);
      const objectFilename =
        safeObjectFilename(file.originalname) || `${makeId("chapter")}.pdf`;
      const objectKey = `chapters/${bookSlug}/${makeId("pdf")}-${objectFilename}`;
      await uploadPdfObject(objectKey, new Uint8Array(file.buffer), file.originalname);
      uploaded.push({
        filename: file.originalname,
        objectKey,
        fileSize: file.size,
        derivedBookTitle,
      });
    }

    // Group uploaded files by their book title so each group lands in the right book
    const groups = new Map<string, typeof uploaded>();
    for (const entry of uploaded) {
      const key = entry.derivedBookTitle;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(entry);
    }

    let totalChapters = 0;
    const bookTitles: string[] = [];

    for (const [bookTitle, groupFiles] of groups) {
      const payload: UploadPayload = { ...basePayload, bookTitle };
      const result = await createAndStoreChapters(
        payload,
        groupFiles.map(({ filename, objectKey, fileSize }) => ({
          filename,
          objectKey,
          fileSize,
        })),
      );
      totalChapters += result.records.length;
      bookTitles.push(result.book.title);
    }

    res.json({
      uploaded: totalChapters,
      bookTitle: bookTitles.join(", "),
    });
  } catch (err) {
    req.log.error({ err }, "Upload failed");
    res.status(500).json({ error: "Upload failed." });
  }
});

export default router;
