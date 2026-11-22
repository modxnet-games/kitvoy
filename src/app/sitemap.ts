import type { MetadataRoute } from "next";

import { catalog } from "@/config/catalog";
import { getProductContent } from "@/config/products";
import { policyLinks, storePolicies } from "@/config/policies";
import { pageLastModified } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { latestDay, toIsoDay } from "@/lib/seo/lastmod";

export const dynamic = "force-dynamic";

/**
 * The pages worth indexing: each product page, the help page and the store
 * policies. Only canonical, indexable URLs belong here; "/" redirects to the
 * product page, and the cart, checkout and admin pages are noindex, so they
 * stay out.
 *
 * lastmod says when a page's content last changed, as a plain date:
 *  - a product page: the later of its copy date and an admin edit to the
 *    product's content (contentUpdatedAt). Not product.updatedAt, which moves
 *    on every sale because stock changes.
 *  - policies: the effective date printed on the page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, siteConfig.url).toString();
  // Products on the shared template: their copy date, an admin edit to the product, and the gallery photos
  const templated = catalog.flatMap((entry) => {
    const content = getProductContent(entry.slug);
    return content ? [{ entry, content }] : [];
  });
  const rows = await prisma.product
    .findMany({ where: { slug: { in: templated.map((t) => t.entry.slug) } }, select: { slug: true, contentUpdatedAt: true } })
    .catch(() => []);
  const editedAt = new Map(rows.map((r) => [r.slug, r.contentUpdatedAt]));
  return [
    ...templated.map(({ entry, content }) => ({
      url: url(entry.path),
      lastModified: latestDay(content.seo.lastModified, editedAt.get(entry.slug)),
      changeFrequency: "weekly" as const,
      priority: 0.9,
      images: content.gallery.map((g) => url(g.src)),
    })),
    { url: url("/support"), lastModified: toIsoDay(pageLastModified.support), changeFrequency: "monthly", priority: 0.5 },
    ...policyLinks.map((l) => ({
      url: url(l.href),
      lastModified: toIsoDay(storePolicies.effectiveDate),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
