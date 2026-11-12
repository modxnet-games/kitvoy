import type { MetadataRoute } from "next";

import { INFLATOR_SLUG, catalog, productPath } from "@/config/catalog";
import { getProductContent } from "@/config/products";
import { policyLinks, storePolicies } from "@/config/policies";
import { pageLastModified } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { latestDay, toIsoDay } from "@/lib/seo/lastmod";

export const dynamic = "force-dynamic";

/**
 * The pages worth indexing: the storefront home, the /products catalog, each
 * product page, the help page and the store policies. Only canonical, indexable URLs belong here; cart, checkout,
 * sign-in, account and admin pages are noindex and stay out.
 *
 * lastmod says when a page's content last changed, as a plain date:
 *  - the inflator page: the latest of its copy (pageLastModified.home), an admin edit
 *    to the product's content (contentUpdatedAt) and the newest published
 *    review. Not product.updatedAt, which moves on every sale because stock
 *    changes.
 *  - policies: the effective date printed on the page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const product = await prisma.product
    .findUnique({
      where: { slug: INFLATOR_SLUG },
      select: {
        contentUpdatedAt: true,
        images: { select: { url: true }, orderBy: { order: "asc" } },
        reviews: { where: { isVisible: true }, select: { moderatedAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 },
      },
    })
    .catch(() => null);
  const url = (path: string) => new URL(path, siteConfig.url).toString();
  const reviewDays = product?.reviews.map((r) => r.moderatedAt ?? r.createdAt) ?? [];
  // Products on the shared template: their copy date, an admin edit to the product, and the first gallery photos
  const templated = catalog.flatMap((entry) => {
    const content = getProductContent(entry.slug);
    return content ? [{ entry, content }] : [];
  });
  const rows = await prisma.product
    .findMany({ where: { slug: { in: templated.map((t) => t.entry.slug) } }, select: { slug: true, contentUpdatedAt: true } })
    .catch(() => []);
  const editedAt = new Map(rows.map((r) => [r.slug, r.contentUpdatedAt]));
  const catalogDay = latestDay(pageLastModified.catalog, ...templated.map((t) => t.content.seo.lastModified));
  return [
    { url: url("/"), lastModified: catalogDay, changeFrequency: "weekly", priority: 1 },
    { url: url("/products"), lastModified: catalogDay, changeFrequency: "weekly", priority: 0.9 },
    ...templated.map(({ entry, content }) => ({
      url: url(entry.path),
      lastModified: latestDay(content.seo.lastModified, editedAt.get(entry.slug)),
      changeFrequency: "weekly" as const,
      priority: 0.9,
      images: content.gallery.map((g) => url(g.src)),
    })),
    {
      url: url(productPath(INFLATOR_SLUG)),
      lastModified: latestDay(pageLastModified.home, product?.contentUpdatedAt, ...reviewDays),
      changeFrequency: "weekly",
      priority: 0.8,
      images: product?.images.map((i) => url(i.url)),
    },
    { url: url("/support"), lastModified: toIsoDay(pageLastModified.support), changeFrequency: "monthly", priority: 0.5 },
    ...policyLinks.map((l) => ({
      url: url(l.href),
      lastModified: toIsoDay(storePolicies.effectiveDate),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
