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
import { parseImportGames } from "../lib/pgn-import.js";

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
    const uploadBatchId = makeId("pgn-batch");
    const importResults: Array<{ index: number; status: "success" | "failed" | "duplicate" | "warning"; white: string; black: string; date: string; event: string; error?: string; createdGameId?: string }> = [];
    const bookSlug = slugify(bookTitle);
    const catalog = await getCatalog();
    const book = await upsertBook(catalog, { ...basePayload, pgn: "" });

    for (const file of files) {
      const pgnText = file.buffer.toString("utf8");
      const parsedGames = parseImportGames(pgnText);
      const objectFilename =
        safeObjectFilename(file.originalname) || `${makeId("pgn")}.pgn`;

      for (let index = 0; index < parsedGames.length; index++) {
        const parsedGame = parsedGames[index];
        const duplicate = catalog.chapters.find(
          (entry) => entry.fileType === "pgn" && entry.pgnFingerprint === parsedGame.fingerprint,
        );

        if (duplicate || parsedGame.error) {
          importResults.push({
            index,
            status: duplicate ? "duplicate" : "failed",
            white: parsedGame.headers.White || "?",
            black: parsedGame.headers.Black || "?",
            date: parsedGame.headers.Date || "????.??.??",
            event: parsedGame.headers.Event || "Unknown Event",
            error: duplicate ? "Duplicate PGN already imported." : parsedGame.error,
            createdGameId: duplicate?.id,
          });
          continue;
        }

        const objectKey = `pgn/${bookSlug}/${makeId("pgn")}-${index + 1}-${objectFilename}`;
        await uploadPgnObject(objectKey, parsedGame.raw, file.originalname);

        const record = createChapterRecord(
          book,
          { ...basePayload, pgn: parsedGame.raw },
          `${String(index + 1).padStart(3, "0")}-${file.originalname}`,
          objectKey,
          Buffer.byteLength(parsedGame.raw, "utf8"),
          "pgn",
        );
        record.title = `${parsedGame.headers.White || "Unknown"} vs ${parsedGame.headers.Black || "Unknown"}`;
        record.pgnFingerprint = parsedGame.fingerprint;
        record.sourceFilename = file.originalname;
        record.uploadBatchId = uploadBatchId;
        record.importedAt = new Date().toISOString();
        record.importStatus = parsedGame.warnings.length ? "warning" : "success";
        catalog.chapters.push(record);
        importResults.push({
          index,
          status: parsedGame.warnings.length ? "warning" : "success",
          white: parsedGame.headers.White || "?",
          black: parsedGame.headers.Black || "?",
          date: parsedGame.headers.Date || "????.??.??",
          event: parsedGame.headers.Event || "Unknown Event",
          createdGameId: record.id,
          error: parsedGame.warnings.join(" ") || undefined,
        });
      }
    }

    book.chapterCount = catalog.chapters.filter(
      (entry) => entry.bookId === book.id,
    ).length;
    book.updatedAt = new Date().toISOString();

    await saveCatalog(catalog);

    res.json({
      uploaded: importResults.filter((item) => item.status === "success" || item.status === "warning").length,
      bookTitle: book.title,
      uploadBatchId,
      results: importResults,
      summary: {
        total: importResults.length,
        imported: importResults.filter((item) => item.status === "success" || item.status === "warning").length,
        failed: importResults.filter((item) => item.status === "failed").length,
        duplicates: importResults.filter((item) => item.status === "duplicate").length,
        warnings: importResults.filter((item) => item.status === "warning").length,
      },
    });
  } catch (err) {
    req.log.error({ err }, "PGN upload failed");
    res.status(500).json({ error: "PGN upload failed." });
  }
});

export default router;
