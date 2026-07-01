export type Catalog = {
  books: BookRecord[];
  chapters: ChapterRecord[];
};

export type BookRecord = {
  id: string;
  title: string;
  slug: string;
  level: string;
  theme: string;
  primarySkill: string;
  chapterCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ChapterTaxonomy = {
  phase: string;
  domain: string;
  openingFamily: string;
  openingVariation: string;
  primaryThemes: string[];
  microTags: string[];
  structures: string[];
  materialTags: string[];
  confidence: number;
  classifiedAt: string;
};

export type ChapterRecord = {
  id: string;
  bookId: string;
  title: string;
  slug: string;
  level: string;
  theme: string;
  primarySkill: string;
  secondarySkills: string[];
  notes: string;
  pgn: string;
  objectKey: string;
  originalFilename: string;
  uploadedAt: string;
  fileSize: number;
  fileType?: "pdf" | "pgn";
  uploadBatchId?: string;
  sourceFilename?: string;
  importedAt?: string;
  importStatus?: "success" | "failed" | "duplicate" | "warning";
  pgnFingerprint?: string;
  taxonomy?: ChapterTaxonomy;
  textPreview?: string;
};

export type UploadPayload = {
  bookTitle: string;
  level: string;
  theme: string;
  primarySkill: string;
  secondarySkills: string[];
  notes: string;
  pgn: string;
};
