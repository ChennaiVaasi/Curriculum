import { NextResponse } from "next/server";

import { createAndStoreChapters } from "@/lib/catalog";
import { isR2Configured, uploadPdfObject } from "@/lib/r2";
import type { UploadPayload } from "@/lib/types";
import { makeId, slugify, splitCsv } from "@/lib/utils";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!isR2Configured()) {
    return NextResponse.json(
      {
        error: "Cloudflare R2 is not configured. Add the values from .env.example to .env.local first.",
      },
      { status: 400 },
    );
  }

  const formData = await request.formData();

  const payload: UploadPayload = {
    bookTitle: String(formData.get("bookTitle") || "").trim(),
    level: String(formData.get("level") || "").trim(),
    theme: String(formData.get("theme") || "").trim(),
    primarySkill: String(formData.get("primarySkill") || "").trim(),
    secondarySkills: splitCsv(String(formData.get("secondarySkills") || "")),
    notes: String(formData.get("notes") || "").trim(),
  };

  const files = formData.getAll("files").filter((entry): entry is File => entry instanceof File);

  if (!payload.bookTitle || !payload.level || !payload.theme || !payload.primarySkill) {
    return NextResponse.json({ error: "Book title, level, theme, and primary skill are required." }, { status: 400 });
  }

  if (!files.length) {
    return NextResponse.json({ error: "Upload at least one PDF file." }, { status: 400 });
  }

  const uploaded: Array<{ filename: string; objectKey: string; fileSize: number }> = [];
  const bookSlug = slugify(payload.bookTitle);

  for (const file of files) {
    if (file.type !== "application/pdf") {
      return NextResponse.json({ error: `Only PDF uploads are supported. ${file.name} is not a PDF.` }, { status: 400 });
    }

    const bytes = new Uint8Array(await file.arrayBuffer());
    const objectKey = `chapters/${bookSlug}/${makeId("pdf")}-${file.name}`;
    await uploadPdfObject(objectKey, bytes, file.name);
    uploaded.push({
      filename: file.name,
      objectKey,
      fileSize: file.size,
    });
  }

  const result = await createAndStoreChapters(payload, uploaded);

  return NextResponse.json({
    uploaded: result.records.length,
    bookTitle: result.book.title,
  });
}
