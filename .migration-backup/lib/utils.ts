import { randomUUID } from "node:crypto";

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function normalizeText(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function splitCsv(value: string) {
  return value
    .split(",")
    .map((entry) => normalizeText(entry))
    .filter(Boolean);
}

export function humanBytes(value: number) {
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

export function chapterTitleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  return normalizeText(withoutExtension.replace(/[_-]+/g, " "));
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}
