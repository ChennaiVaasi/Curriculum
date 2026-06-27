import { NextResponse } from "next/server";

import { getChapterById } from "@/lib/catalog";
import { getBinaryObject } from "@/lib/r2";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body = (await request.json()) as { apiKey?: string; chapterId?: string };
  const apiKey = body.apiKey?.trim();
  const chapterId = body.chapterId?.trim();

  if (!apiKey || !chapterId) {
    return NextResponse.json({ error: "apiKey and chapterId are required." }, { status: 400 });
  }

  const result = await getChapterById(chapterId);

  if (!result) {
    return NextResponse.json({ error: "Chapter not found." }, { status: 404 });
  }

  const file = await getBinaryObject(result.chapter.objectKey);
  const formData = new FormData();
  const arrayBuffer = file.bytes.buffer.slice(
    file.bytes.byteOffset,
    file.bytes.byteOffset + file.bytes.byteLength,
  ) as ArrayBuffer;
  formData.set("file", new Blob([arrayBuffer], { type: "application/pdf" }), result.chapter.originalFilename);

  const response = await fetch("https://api.chatpdf.com/v1/sources/add-file", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
    },
    body: formData,
  });

  const payload = (await response.json()) as { sourceId?: string; message?: string };

  if (!response.ok || !payload.sourceId) {
    return NextResponse.json(
      {
        error: payload.message || "ChatPDF could not ingest the selected chapter.",
      },
      { status: 400 },
    );
  }

  return NextResponse.json({ sourceId: payload.sourceId });
}
