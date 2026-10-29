import { siteConfig } from "@/config/site";

function tryParseAppOrigin(): string | null {
  try {
    return new URL(siteConfig.url).origin;
  } catch {
    return null;
  }
}

/** Treat www and non-www as the same site when normalizing absolute URLs. */
function hostnameKey(host: string): string {
  const h = host.toLowerCase();
  return h.startsWith("www.") ? h.slice(4) : h;
}

/**
 * Normalize image URLs stored in DB / CMS for use in the browser (img / next/image src).
 * - Converts mistaken localhost / 127.0.0.1 absolute URLs to same-origin paths (fixes production).
 * - Collapses absolute URLs that match NEXT_PUBLIC_APP_URL to pathname-only (portable across envs).
 * - Preserves true external URLs (CDNs).
 * - Ensures a leading slash for site-relative paths.
 */
export function normalizeMediaSrc(stored: string | null | undefined): string {
  if (stored == null) return "";
  let s = String(stored).trim();
  if (!s) return "";

  s = s.replace(/\\/g, "/");

  if (s.startsWith("blob:") || s.startsWith("data:")) {
    return s;
  }

  if (s.startsWith("//")) {
    try {
      const proto = new URL(siteConfig.url).protocol;
      return normalizeMediaSrc(`${proto}${s}`);
    } catch {
      return `https:${s}`;
    }
  }

  if (/^https?:\/\//i.test(s)) {
    try {
      const u = new URL(s);
      const host = u.hostname.toLowerCase();

      // Supabase Storage URLs are external CDN — return as-is
      if (host.endsWith(".supabase.co")) {
        return s;
      }

      if (
        host === "localhost" ||
        host === "127.0.0.1" ||
        host === "[::1]" ||
        host === "::1"
      ) {
        return u.pathname || "/";
      }
      const appOrigin = tryParseAppOrigin();
      if (appOrigin) {
        try {
          const appHost = hostnameKey(new URL(appOrigin).hostname);
          if (hostnameKey(u.hostname) === appHost) {
            return `${u.pathname}${u.search}${u.hash}` || "/";
          }
        } catch {
          /* ignore */
        }
      }
      return s;
    } catch {
      return s;
    }
  }

  if (!s.startsWith("/")) return `/${s}`;
  return s;
}

/**
 * Absolute URL for a stored media path (relative like /uploads/... or full URL).
 * Use when the consumer is not the browser same-origin (emails, metadata, etc.).
 * In the storefront, prefer relative paths so they work on localhost and production.
 */
export function absoluteMediaUrl(path: string): string {
  if (!path?.trim()) return "";
  const normalized = normalizeMediaSrc(path);
  if (!normalized) return "";
  if (normalized.startsWith("blob:") || normalized.startsWith("data:")) {
    return normalized;
  }
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const base = siteConfig.url.replace(/\/$/, "");
  const rel = normalized.startsWith("/") ? normalized : `/${normalized}`;
  return `${base}${rel}`;
}

/**
 * Use for <img src> for DB / upload paths.
 *
 * Do NOT prefix with NEXT_PUBLIC_APP_URL: if the site is opened as `www.kitvoy.com` but
 * env is `https://kitvoy.com`, absolute URLs become cross-origin and images often break.
 * Same-origin `/uploads/...` works for www, apex, and localhost.
 *
 * External CDN URLs stay absolute; blob:/data: unchanged (via normalizeMediaSrc).
 */
export function resolvedMediaUrl(stored: string | null | undefined): string {
  if (stored == null) return "";
  return normalizeMediaSrc(stored);
}

/** Detect product media URLs that should render as <video> (by path extension). */
export function isVideoMediaUrl(stored: string | null | undefined): boolean {
  const s = normalizeMediaSrc(stored ?? "").toLowerCase();
  if (!s) return false;
  const pathOnly = (s.split("?")[0] ?? s).trim();
  return /\.(mp4|webm|mov|ogv|ogg)$/i.test(pathOnly);
}
