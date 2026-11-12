import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { getCatalogCards } from "@/lib/data/catalog";
import { graph, itemListSchema } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/seo/json-ld";
import { CatalogHub } from "@/components/catalog/catalog-hub";

// Live prices
export const dynamic = "force-dynamic";

const title = "Kitvoy Finds – The Products From Our Videos";
const description = "Every product from Kitvoy's videos in one place, numbered to match. Pet care, home organization and daily comfort finds, with free tracked shipping.";

/**
 * /products: the link in the Instagram and TikTok bios. Videos say "link #01
 * in bio"; this page lists the products by that number. It replaces the
 * /links page the roadmap first planned.
 */
export const metadata: Metadata = {
  title: { absolute: title },
  description,
  alternates: { canonical: "/products" },
  openGraph: {
    type: "website",
    url: "/products",
    siteName: siteConfig.name,
    title,
    description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: { card: "summary_large_image", title, description, images: [siteConfig.ogImage] },
};

export default async function ProductsHubPage() {
  const cards = await getCatalogCards();
  return (
    <>
      <JsonLd data={graph(itemListSchema(cards.map((c) => ({ name: c.entry.shortName, path: c.entry.path }))))} />
      <CatalogHub cards={cards} variant="hub" />
    </>
  );
}
