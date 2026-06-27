import { promises as fs } from "node:fs";
import path from "node:path";

import { getCatalogObjectKey, getTextObject, isR2Configured, putTextObject } from "./r2.js";
import type { BookRecord, Catalog, ChapterRecord, UploadPayload } from "./types.js";
import { chapterTitleFromFilename, makeId, normalizeText, slugify } from "./utils.js";

const localCatalogPath = path.join(process.cwd(), "data", "catalog.json");

const emptyCatalog: Catalog = {
  books: [],
  chapters: [],
};

async function ensureLocalCatalog() {
  try {
    await fs.access(localCatalogPath);
  } catch {
    await fs.mkdir(path.dirname(localCatalogPath), { recursive: true });
    await fs.writeFile(localCatalogPath, JSON.stringify(emptyCatalog, null, 2));
  }
}

export async function getCatalog(): Promise<Catalog> {
  if (isR2Configured()) {
    try {
      const text = await getTextObject(getCatalogObjectKey());
      return JSON.parse(text) as Catalog;
    } catch {
      return emptyCatalog;
    }
  }

  await ensureLocalCatalog();
  const text = await fs.readFile(localCatalogPath, "utf8");
  return JSON.parse(text) as Catalog;
}

export async function saveCatalog(catalog: Catalog) {
  const serialized = JSON.stringify(catalog, null, 2);
  if (isR2Configured()) {
    await putTextObject(getCatalogObjectKey(), serialized);
    return;
  }

  await ensureLocalCatalog();
  await fs.writeFile(localCatalogPath, serialized);
}

export async function upsertBook(catalog: Catalog, payload: UploadPayload) {
  const now = new Date().toISOString();
  const slug = slugify(payload.bookTitle);

  let book = catalog.books.find((entry) => entry.slug === slug);

  if (!book) {
    book = {
      id: makeId("book"),
      title: normalizeText(payload.bookTitle),
      slug,
      level: normalizeText(payload.level),
      theme: normalizeText(payload.theme),
      primarySkill: normalizeText(payload.primarySkill),
      chapterCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    catalog.books.push(book);
  } else {
    book.level = normalizeText(payload.level);
    book.theme = normalizeText(payload.theme);
    book.primarySkill = normalizeText(payload.primarySkill);
    book.updatedAt = now;
  }

  return book;
}

export function createChapterRecord(
  book: BookRecord,
  payload: UploadPayload,
  filename: string,
  objectKey: string,
  fileSize: number,
): ChapterRecord {
  const title = chapterTitleFromFilename(filename);
  const now = new Date().toISOString();

  return {
    id: makeId("chapter"),
    bookId: book.id,
    title,
    slug: slugify(title),
    level: normalizeText(payload.level),
    theme: normalizeText(payload.theme),
    primarySkill: normalizeText(payload.primarySkill),
    secondarySkills: payload.secondarySkills,
    notes: normalizeText(payload.notes),
    objectKey,
    originalFilename: filename,
    uploadedAt: now,
    fileSize,
  };
}

export async function createAndStoreChapters(
  payload: UploadPayload,
  files: Array<{ filename: string; objectKey: string; fileSize: number }>,
) {
  const catalog = await getCatalog();
  const book = await upsertBook(catalog, payload);
  const records = files.map((file) =>
    createChapterRecord(book, payload, file.filename, file.objectKey, file.fileSize),
  );

  for (const record of records) {
    catalog.chapters.push(record);
  }

  book.chapterCount = catalog.chapters.filter((entry) => entry.bookId === book.id).length;
  book.updatedAt = new Date().toISOString();

  await saveCatalog(catalog);

  return { book, records };
}

export async function getBookById(bookId: string) {
  const catalog = await getCatalog();
  const book = catalog.books.find((entry) => entry.id === bookId);
  if (!book) {
    return null;
  }

  const chapters = catalog.chapters
    .filter((entry) => entry.bookId === bookId)
    .sort((left, right) => left.uploadedAt.localeCompare(right.uploadedAt));

  return { book, chapters };
}

export async function getChapterById(chapterId: string) {
  const catalog = await getCatalog();
  const chapter = catalog.chapters.find((entry) => entry.id === chapterId);
  if (!chapter) {
    return null;
  }

  const book = catalog.books.find((entry) => entry.id === chapter.bookId) || null;
  const siblings = catalog.chapters.filter((entry) => entry.bookId === chapter.bookId);

  return { chapter, book, siblings };
}
