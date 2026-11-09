import type { MetadataRoute } from "next";

import { landingConfig } from "@/config/landing";
import { policyLinks, storePolicies } from "@/config/policies";
import { pageLastModified } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { latestDay, toIsoDay } from "@/lib/seo/lastmod";

export const dynamic = "force-dynamic";

/**
 * The pages worth indexing: the product homepage, the help page and the store
 * policies. Only canonical, indexable URLs belong here; cart, checkout,
 * sign-in, account and admin pages are noindex and stay out.
 *
 * lastmod says when a page's content last changed, as a plain date:
 *  - homepage: the latest of its copy (pageLastModified.home), an admin edit
 *    to the product's content (contentUpdatedAt) and the newest published
 *    review. Not product.updatedAt, which moves on every sale because stock
 *    changes.
 *  - policies: the effective date printed on the page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const product = await prisma.product
    .findUnique({
      where: { slug: landingConfig.productSlug },
      select: {
        contentUpdatedAt: true,
        images: { select: { url: true }, orderBy: { order: "asc" } },
        reviews: { where: { isVisible: true }, select: { moderatedAt: true, createdAt: true }, orderBy: { createdAt: "desc" }, take: 20 },
      },
    })
    .catch(() => null);
  const url = (path: string) => new URL(path, siteConfig.url).toString();
  const reviewDays = product?.reviews.map((r) => r.moderatedAt ?? r.createdAt) ?? [];
  return [
    {
      url: url("/"),
      lastModified: latestDay(pageLastModified.home, product?.contentUpdatedAt, ...reviewDays),
      changeFrequency: "weekly",
      priority: 1,
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
