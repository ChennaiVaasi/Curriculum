import { Router } from "express";
import { getCatalog, getBookById, getChapterById } from "../lib/catalog.js";

const router = Router();

router.get("/catalog", async (req, res) => {
  try {
    const catalog = await getCatalog();
    res.json(catalog);
  } catch (err) {
    req.log.error({ err }, "Failed to get catalog");
    res.status(500).json({ error: "Failed to load catalog." });
  }
});

router.get("/books/:bookId", async (req, res) => {
  try {
    const result = await getBookById(req.params.bookId);
    if (!result) {
      res.status(404).json({ error: "Book not found." });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get book");
    res.status(500).json({ error: "Failed to load book." });
  }
});

router.get("/chapters/:chapterId", async (req, res) => {
  try {
    const result = await getChapterById(req.params.chapterId);
    if (!result) {
      res.status(404).json({ error: "Chapter not found." });
      return;
    }
    res.json(result);
  } catch (err) {
    req.log.error({ err }, "Failed to get chapter");
    res.status(500).json({ error: "Failed to load chapter." });
  }
});

export default router;
