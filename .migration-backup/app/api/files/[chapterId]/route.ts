import { NextResponse } from "next/server";

import { getChapterById } from "@/lib/catalog";
import { getBinaryObject } from "@/lib/r2";

export const runtime = "nodejs";

export async function GET(_: Request, { params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  const result = await getChapterById(chapterId);

  if (!result) {
    return new NextResponse("Chapter not found.", { status: 404 });
  }

  const file = await getBinaryObject(result.chapter.objectKey);
  const arrayBuffer = file.bytes.buffer.slice(
    file.bytes.byteOffset,
    file.bytes.byteOffset + file.bytes.byteLength,
  ) as ArrayBuffer;

  return new NextResponse(arrayBuffer, {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="${result.chapter.originalFilename}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
