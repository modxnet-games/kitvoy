import type { MetadataRoute } from "next";

import { siteConfig } from "@/config/site";

/**
 * Every crawler, AI search included, may read the store. Admin and API routes
 * stay out; cart, checkout and account pages are crawlable but carry noindex.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/admin", "/api/"] }],
    sitemap: new URL("/sitemap.xml", siteConfig.url).toString(),
  };
}
