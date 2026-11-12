import type { Metadata } from "next";

import { siteConfig } from "@/config/site";
import { getCatalogCards } from "@/lib/data/catalog";
import { getStoreSettings } from "@/lib/data/store-settings";
import { graph, itemListSchema, organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/seo/json-ld";
import { CatalogHub } from "@/components/catalog/catalog-hub";

export const dynamic = "force-dynamic";

const title = "Kitvoy – Useful Finds for Pets, Home and Everyday Comfort";

/**
 * The storefront home: the brand and its niches, each product linking to its
 * own page. The cordless tire inflator's landing page, which used to be this
 * page, now lives at /inflator.
 */
// A page's openGraph/twitter replace the layout's rather than merging, so the share image is repeated here
export const metadata: Metadata = {
  title: { absolute: title },
  description: siteConfig.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title,
    description: siteConfig.description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
  },
  twitter: { card: "summary_large_image", title, description: siteConfig.description, images: [siteConfig.ogImage] },
};

export default async function HomePage() {
  const [cards, settings] = await Promise.all([getCatalogCards(), getStoreSettings().catch(() => null)]);
  const structured = graph(
    organizationSchema({
      supportEmail: settings?.supportEmail,
      supportPhone: settings?.supportPhone,
      legalName: settings?.legalName,
      address: settings?.businessAddress,
      // Only the profiles the owner switched on in Store settings
      sameAs: settings
        ? [
            settings.facebookEnabled ? settings.facebookUrl : "",
            settings.instagramEnabled ? settings.instagramUrl : "",
            settings.tiktokEnabled ? settings.tiktokUrl : "",
          ]
        : [],
    }),
    websiteSchema(),
    itemListSchema(cards.map((c) => ({ name: c.entry.shortName, path: c.entry.path }))),
  );
  return (
    <>
      <JsonLd data={structured} />
      <CatalogHub cards={cards} variant="home" />
    </>
  );
}
