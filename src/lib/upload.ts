import { mkdir, unlink, writeFile } from "fs/promises";
import path from "path";

/**
 * Uploads are stored on local disk under UPLOAD_DIR and served at /uploads/...
 * In production nginx serves UPLOAD_DIR directly (Next.js does not serve files
 * added to public/ after the build), and app/uploads/[...path] serves the same
 * files to Next's image optimizer. Defaults to public/uploads for local dev.
 */
const UPLOAD_DIR = path.resolve(
  process.env.UPLOAD_DIR?.trim() || path.join(process.cwd(), "public", "uploads"),
);
const PUBLIC_PREFIX = "/uploads/";

/* ------------------------------------------------------------------ */
/*  MIME / extension helpers                                           */
/* ------------------------------------------------------------------ */

const ALLOWED_CANONICAL = ["image/jpeg", "image/png", "image/webp"] as const;
type CanonicalMime = (typeof ALLOWED_CANONICAL)[number];

const MIME_ALIASES: Record<string, CanonicalMime> = {
  "image/jpg": "image/jpeg",
  "image/pjpeg": "image/jpeg",
  "image/x-png": "image/png",
};

const MIME_TO_EXT: Record<CanonicalMime, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

const EXT_TO_MIME: Record<string, CanonicalMime> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

function resolveCanonicalMime(file: File): CanonicalMime | null {
  let raw = (file.type || "").toLowerCase().trim();
  if (raw && MIME_ALIASES[raw]) raw = MIME_ALIASES[raw];
  if (raw && ALLOWED_CANONICAL.includes(raw as CanonicalMime)) {
    return raw as CanonicalMime;
  }
  const ext = path.extname(file.name).toLowerCase();
  return EXT_TO_MIME[ext] ?? null;
}

/** Max file size for images (JPEG / PNG / WebP) */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Max product video size — keep under Next `proxyClientMaxBodySize` (25mb). */
export const MAX_PRODUCT_VIDEO_BYTES = 24 * 1024 * 1024;

const ALLOWED_VIDEO_CANONICAL = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
] as const;
type VideoCanonicalMime = (typeof ALLOWED_VIDEO_CANONICAL)[number];

const VIDEO_MIME_ALIASES: Record<string, VideoCanonicalMime> = {
  "video/x-quicktime": "video/quicktime",
};

const VIDEO_MIME_TO_EXT: Record<VideoCanonicalMime, string> = {
  "video/mp4": ".mp4",
  "video/webm": ".webm",
  "video/quicktime": ".mov",
};

const VIDEO_EXT_TO_MIME: Record<string, VideoCanonicalMime> = {
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
};

function resolveCanonicalVideoMime(file: File): VideoCanonicalMime | null {
  let raw = (file.type || "").toLowerCase().trim();
  if (raw && VIDEO_MIME_ALIASES[raw]) raw = VIDEO_MIME_ALIASES[raw];
  if (raw && ALLOWED_VIDEO_CANONICAL.includes(raw as VideoCanonicalMime)) {
    return raw as VideoCanonicalMime;
  }
  const ext = path.extname(file.name).toLowerCase();
  return VIDEO_EXT_TO_MIME[ext] ?? null;
}

/* ------------------------------------------------------------------ */
/*  Validation                                                         */
/* ------------------------------------------------------------------ */

function validateImageFile(file: File): { error: string } | null {
  const mime = resolveCanonicalMime(file);
  if (!mime) {
    return { error: "Invalid file type. Use JPEG, PNG, or WebP only." };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: "File too large. Maximum size is 5MB." };
  }
  if (file.size < 1) {
    return { error: "File is empty." };
  }
  return null;
}

function validateProductVideoFile(file: File): { error: string } | null {
  const mime = resolveCanonicalVideoMime(file);
  if (!mime) {
    return { error: "Invalid video type. Use MP4, WebM, or MOV." };
  }
  if (file.size > MAX_PRODUCT_VIDEO_BYTES) {
    return { error: "Video too large. Maximum size is 24MB." };
  }
  if (file.size < 1) {
    return { error: "File is empty." };
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Upload segment types                                               */
/* ------------------------------------------------------------------ */

export type UploadSegment = "products" | "banners" | "categories" | "reviews";

/* ------------------------------------------------------------------ */
/*  Local disk storage helpers                                         */
/* ------------------------------------------------------------------ */

/**
 * Write a buffer to UPLOAD_DIR/{storagePath} and return its public URL.
 */
async function uploadToStorage(
  storagePath: string,
  buffer: Buffer,
): Promise<{ url: string } | { error: string }> {
  try {
    const filePath = path.join(UPLOAD_DIR, storagePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, buffer, { flag: "wx" });
    return { url: `${PUBLIC_PREFIX}${storagePath}` };
  } catch (err) {
    console.error("Upload write error:", err);
    return { error: "Upload failed. Please try again." };
  }
}

/** Map a stored /uploads/... URL to its file on disk, or null if it isn't one. */
export function toUploadFilePath(fileUrl: string): string | null {
  let pathname = fileUrl;
  try {
    pathname = new URL(fileUrl, "http://localhost").pathname;
  } catch {
    return null;
  }
  if (!pathname.startsWith(PUBLIC_PREFIX)) return null;

  const filePath = path.resolve(UPLOAD_DIR, decodeURIComponent(pathname.slice(PUBLIC_PREFIX.length)));
  // Never delete outside the uploads directory
  if (!filePath.startsWith(UPLOAD_DIR + path.sep)) return null;
  return filePath;
}

/**
 * Delete an uploaded file given its public URL.
 * Silently logs errors — callers should not block on storage cleanup failures.
 */
export async function deleteFromStorage(fileUrl: string): Promise<void> {
  if (!fileUrl) return;
  const filePath = toUploadFilePath(fileUrl);
  if (!filePath) return;

  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.error(`Failed to delete ${filePath}:`, err);
    }
  }
}

/**
 * Delete multiple uploaded files. Non-blocking — errors are logged.
 */
export async function deleteMultipleFromStorage(fileUrls: string[]): Promise<void> {
  await Promise.all(fileUrls.map(deleteFromStorage));
}

/* ------------------------------------------------------------------ */
/*  Image upload                                                       */
/* ------------------------------------------------------------------ */

async function saveUploadImage(
  file: File,
  segment: UploadSegment,
  namePrefix: string,
): Promise<{ url: string } | { error: string }> {
  const invalid = validateImageFile(file);
  if (invalid) return invalid;

  const mime = resolveCanonicalMime(file)!;
  const ext = MIME_TO_EXT[mime];

  const base = `${namePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const filename = `${base}${ext}`;
  const storagePath = `${segment}/${filename}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return uploadToStorage(storagePath, buffer);
}

/* ------------------------------------------------------------------ */
/*  Video upload                                                       */
/* ------------------------------------------------------------------ */

async function saveUploadVideo(
  file: File,
  segment: UploadSegment,
  namePrefix: string,
): Promise<{ url: string } | { error: string }> {
  const invalid = validateProductVideoFile(file);
  if (invalid) return invalid;

  const mime = resolveCanonicalVideoMime(file)!;
  const ext = VIDEO_MIME_TO_EXT[mime];

  const base = `${namePrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const filename = `${base}${ext}`;
  const storagePath = `${segment}/${filename}`;

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  return uploadToStorage(storagePath, buffer);
}

/* ------------------------------------------------------------------ */
/*  Public API (same signatures as before — no consumer changes needed)*/
/* ------------------------------------------------------------------ */

/** Product gallery: JPEG, PNG, WebP (5MB max) or MP4 / WebM / MOV (24MB max). */
export async function uploadProductMedia(
  file: File,
): Promise<{ url: string } | { error: string }> {
  if (resolveCanonicalMime(file)) {
    return saveUploadImage(file, "products", "product");
  }
  if (resolveCanonicalVideoMime(file)) {
    return saveUploadVideo(file, "products", "product");
  }
  return {
    error:
      "Invalid file type. Use an image (JPEG, PNG, WebP) or video (MP4, WebM, MOV).",
  };
}

export async function uploadProductImage(
  file: File,
): Promise<{ url: string } | { error: string }> {
  return uploadProductMedia(file);
}

export async function uploadHomepageImage(
  file: File,
): Promise<{ url: string } | { error: string }> {
  return saveUploadImage(file, "banners", "banner");
}

export async function uploadCategoryImage(
  file: File,
): Promise<{ url: string } | { error: string }> {
  return saveUploadImage(file, "categories", "category");
}

export async function uploadReviewImage(
  file: File,
): Promise<{ url: string } | { error: string }> {
  return saveUploadImage(file, "reviews", "review");
}
