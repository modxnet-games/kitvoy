import type { MetadataRoute } from "next";

import { catalog } from "@/config/catalog";
import { getProductEntry } from "@/config/products";
import { policyLinks, storePolicies } from "@/config/policies";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { publicFileExists } from "@/lib/public-files";
import { latestDay, toIsoDay } from "@/lib/seo/lastmod";

export const dynamic = "force-dynamic";

/**
 * The pages worth indexing: the product page (the home page), the help page
 * and the store policies. The cart, checkout and admin pages are noindex, so
 * they stay out.
 *
 * lastmod says when a page's content last changed, as a plain date: for the
 * product page, the later of its copy date and an admin edit to the product's
 * content (contentUpdatedAt, not updatedAt, which moves on every order because
 * stock changes); for policies, the effective date printed on the page.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, siteConfig.url).toString();
  const pages = catalog.flatMap((entry) => {
    const page = getProductEntry(entry.slug);
    return page ? [{ entry, page }] : [];
  });
  const rows = await prisma.product
    .findMany({ where: { slug: { in: pages.map((p) => p.entry.slug) } }, select: { slug: true, contentUpdatedAt: true } })
    .catch(() => []);
  const editedAt = new Map(rows.map((r) => [r.slug, r.contentUpdatedAt]));
  const policyDay = toIsoDay(storePolicies.effectiveDate);
  return [
    ...pages.map(({ entry, page }) => ({
      url: url(entry.path),
      lastModified: latestDay(page.lastModified, editedAt.get(entry.slug)),
      changeFrequency: "weekly" as const,
      priority: 1,
      images: page.content.fr.gallery.filter((g) => publicFileExists(g.src)).slice(0, 5).map((g) => url(g.src)),
    })),
    { url: url("/support"), lastModified: policyDay, changeFrequency: "monthly", priority: 0.5 },
    ...policyLinks.map((l) => ({ url: url(l.href), lastModified: policyDay, changeFrequency: "yearly" as const, priority: 0.3 })),
  ];
}
