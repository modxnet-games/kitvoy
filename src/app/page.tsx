import type { Metadata } from "next";

import { landingConfig } from "@/config/landing";
import { productSeo } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { getProductBySlug } from "@/lib/data/products";
import { getStoreSettings } from "@/lib/data/store-settings";
import { faqSchema, graph, organizationSchema, productSchema, websiteSchema } from "@/lib/seo/structured-data";
import { storefrontFaqs } from "@/lib/storefront-faq";
import { JsonLd } from "@/components/seo/json-ld";
import { StorefrontHome } from "@/components/landing/storefront-home";

export const dynamic = "force-dynamic";

// A page's openGraph/twitter replace the layout's rather than merging, so the share image is repeated here
export const metadata: Metadata = {
  title: { absolute: productSeo.pageTitle },
  description: productSeo.description,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: siteConfig.name,
    title: productSeo.pageTitle,
    description: productSeo.description,
    images: [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: "Kitvoy cordless tire inflator" }],
  },
  twitter: { card: "summary_large_image", title: productSeo.pageTitle, description: productSeo.description, images: [siteConfig.ogImage] },
};

export default async function HomePage() {
  // Never substitute an unrelated featured product for the inflator.
  const [product, settings] = await Promise.all([
    getProductBySlug(landingConfig.productSlug).catch(() => null),
    getStoreSettings().catch(() => null),
  ]);
  const structured = graph(
    organizationSchema(settings?.supportEmail || undefined),
    websiteSchema(),
    ...(product ? [productSchema(product), faqSchema(storefrontFaqs((product.shippingTax ?? 0) === 0))] : []),
  );
  return (
    <>
      <JsonLd data={structured} />
      <StorefrontHome product={product} />
    </>
  );
}
