import type { MetadataRoute } from "next";

import { landingConfig } from "@/config/landing";
import { policyLinks, storePolicies } from "@/config/policies";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The pages worth indexing: the product homepage, the help page and the store policies. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const product = await prisma.product
    .findUnique({ where: { slug: landingConfig.productSlug }, select: { updatedAt: true, images: { select: { url: true } } } })
    .catch(() => null);
  const url = (path: string) => new URL(path, siteConfig.url).toString();
  return [
    {
      url: url("/"),
      lastModified: product?.updatedAt ?? new Date(),
      changeFrequency: "weekly",
      priority: 1,
      images: product?.images.map((i) => url(i.url)),
    },
    { url: url("/support"), changeFrequency: "monthly", priority: 0.5 },
    ...policyLinks.map((l) => ({
      url: url(l.href),
      lastModified: new Date(storePolicies.effectiveDate),
      changeFrequency: "yearly" as const,
      priority: 0.3,
    })),
  ];
}
