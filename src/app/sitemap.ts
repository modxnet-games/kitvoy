import type { MetadataRoute } from "next";

import { landingConfig } from "@/config/landing";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

/** The pages worth indexing: the product homepage and the help page. */
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
  ];
}
