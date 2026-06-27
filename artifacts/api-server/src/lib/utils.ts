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
  const parts = withoutExtension.split(/\s+[-–]\s+/);
  const raw = parts.length >= 2 ? parts.slice(1).join(" - ") : parts[0];
  return normalizeText(raw.replace(/[_]+/g, " "));
}

export function bookTitleFromFilename(filename: string) {
  const withoutExtension = filename.replace(/\.[^.]+$/, "");
  const parts = withoutExtension.split(/\s+[-–]\s+/);
  const raw = parts.length >= 2 ? parts[0] : withoutExtension;
  return normalizeText(raw.replace(/[_]+/g, " "));
}

export function makeId(prefix: string) {
  return `${prefix}_${randomUUID().replace(/-/g, "")}`;
}
