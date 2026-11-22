/**
 * When each page's visible copy last changed, for the sitemap's lastmod.
 * Bump a date only when what a visitor reads on that page changes: not for
 * styling, tracking or refactors. A product page's date lives with its copy
 * (config/products) and follows admin edits on its own (see sitemap.ts).
 */
export const pageLastModified = {
  /** Help page: payments are by Stripe and PayPal; who operates the store, when published */
  support: "2026-11-10",
} as const;
