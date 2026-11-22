import { existsSync } from "node:fs";
import path from "node:path";

const seen = new Map<string, boolean>();

/**
 * Whether a file under /public exists, for pages that would rather leave a
 * photo out than show a broken one. Server only. Answers are remembered for
 * the life of the process (a release's files never change while it runs).
 */
export function publicFileExists(src: string): boolean {
  if (!src.startsWith("/") || src.includes("..")) return false;
  const known = seen.get(src);
  if (known !== undefined) return known;
  const found = existsSync(path.join(process.cwd(), "public", ...src.split("/").filter(Boolean)));
  // In development a photo may arrive later: only remember the ones that are there
  if (found || process.env.NODE_ENV === "production") seen.set(src, found);
  return found;
}
