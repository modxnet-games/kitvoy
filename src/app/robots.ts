import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * Every crawler, AI search included, may read the store.
 *
 * Blocked from crawling (these are not pages):
 *  - /api/      JSON endpoints and the Google sign-in hand-off
 *  - /cdn-cgi/  Cloudflare's own endpoints. Its email protection rewrites every
 *               mailto: link to /cdn-cgi/l/email-protection, which answers 404
 *               to a crawler; Cloudflare's guidance is to disallow the path.
 *
 * Not blocked, on purpose: /admin, cart, checkout, sign-in and account pages.
 * They carry noindex, and a crawler has to be able to fetch a page to see
 * that. Blocking them here would hide the noindex and leave the bare URL
 * eligible for the index.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/api/", "/cdn-cgi/"] }],
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
  };
}
