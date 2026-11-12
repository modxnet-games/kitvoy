import type { Metadata } from "next";

import { INFLATOR_SLUG, productPath } from "@/config/catalog";
import { productSeo } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { getProductBySlug } from "@/lib/data/products";
import { getProductReviewSummary } from "@/lib/data/reviews";
import { getStoreSettings } from "@/lib/data/store-settings";
import { STORE_TIME_ZONE } from "@/lib/formatters";
import { faqSchema, graph, organizationSchema, productSchema, websiteSchema } from "@/lib/seo/structured-data";
import { storefrontFaqs } from "@/lib/storefront-faq";
import { JsonLd } from "@/components/seo/json-ld";
import { StorefrontHome } from "@/components/landing/storefront-home";

export const dynamic = "force-dynamic";

/** /inflator: the cordless tire inflator's landing page, which was the homepage until the store took on more products. */
const path = productPath(INFLATOR_SLUG);

// A page's openGraph/twitter replace the layout's rather than merging, so the share image is repeated here
export const metadata: Metadata = {
  title: { absolute: productSeo.pageTitle },
  description: productSeo.description,
  alternates: { canonical: path },
  openGraph: {
    type: "website",
    url: path,
    siteName: siteConfig.name,
    title: productSeo.pageTitle,
    description: productSeo.description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: "Kitvoy cordless tire inflator" }],
  },
  twitter: { card: "summary_large_image", title: productSeo.pageTitle, description: productSeo.description, images: [siteConfig.ogImage] },
};

/** November through February in the store's time zone, when the cold-morning tire tip is shown. */
function isWinter(now = new Date()) {
  const month = Number(new Intl.DateTimeFormat("en-US", { month: "numeric", timeZone: STORE_TIME_ZONE }).format(now));
  return month >= 11 || month <= 2;
}

export default async function InflatorPage() {
  // Never substitute an unrelated featured product for the inflator.
  const [product, settings] = await Promise.all([
    getProductBySlug(INFLATOR_SLUG).catch(() => null),
    getStoreSettings().catch(() => null),
  ]);
  // The reviews section and the rating markup come from the same approved reviews
  const reviews = product ? await getProductReviewSummary(product.id) : null;
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
    ...(product ? [productSchema(product, reviews), faqSchema(storefrontFaqs((product.shippingTax ?? 0) === 0, product.price), path)] : []),
  );
  return (
    <>
      <JsonLd data={structured} />
      <StorefrontHome product={product} reviews={reviews} paypalClientId={process.env.PAYPAL_CLIENT_ID?.trim() || null} winterTip={isWinter()} />
    </>
  );
}
