import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { toUploadFilePath } from "@/lib/upload";

const CONTENT_TYPES: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

/**
 * GET /uploads/... — serves admin uploads from UPLOAD_DIR. Visitors normally
 * get these from nginx; this route is what Next's image optimizer (and any
 * setup without the nginx alias) reads, since uploads live outside public/.
 * Upload names are unique, so files can be cached forever.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const filePath = toUploadFilePath("/uploads/" + segments.map(encodeURIComponent).join("/"));
  const contentType = filePath ? CONTENT_TYPES[path.extname(filePath).toLowerCase()] : undefined;
  if (!filePath || !contentType) return new Response("Not found", { status: 404 });

  const info = await stat(filePath).catch(() => null);
  if (!info?.isFile()) return new Response("Not found", { status: 404 });

  return new Response(Readable.toWeb(createReadStream(filePath)) as ReadableStream, {
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(info.size),
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
