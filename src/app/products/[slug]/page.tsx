import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";

import { catalog } from "@/config/catalog";
import { getProductContent } from "@/config/products";
import { siteConfig } from "@/config/site";
import { getProductBySlug } from "@/lib/data/products";
import { getProductReviewSummary } from "@/lib/data/reviews";
import { getStoreSettings } from "@/lib/data/store-settings";
import { productFaqs } from "@/lib/product-faq";
import { catalogProductSchema, faqSchema, graph, organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductPage } from "@/components/product/product-page";

// Live price and stock, and the visitor's country, are read per request
export const dynamic = "force-dynamic";

type Params = { slug: string };

/** The catalog product whose page is /products/<slug>, with its copy. */
function find(slug: string) {
  const entry = catalog.find((p) => p.path === `/products/${slug}`);
  const content = entry ? getProductContent(entry.slug) : undefined;
  return entry && content ? { entry, content } : null;
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const found = find((await params).slug);
  if (!found) return {};
  const { entry, content } = found;
  const image = content.gallery[0];
  return {
    title: { absolute: content.seo.pageTitle },
    description: content.seo.description,
    alternates: { canonical: entry.path },
    openGraph: {
      type: "website",
      url: entry.path,
      siteName: siteConfig.name,
      title: content.seo.pageTitle,
      description: content.seo.description,
      images: image ? [{ url: image.src, alt: image.alt }] : [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
    },
    twitter: { card: "summary_large_image", title: content.seo.pageTitle, description: content.seo.description, images: [image?.src ?? siteConfig.ogImage] },
  };
}

export default async function CatalogProductPage({ params }: { params: Promise<Params> }) {
  const found = find((await params).slug);
  if (!found) notFound();
  const { entry, content } = found;

  const [product, settings, headerList] = await Promise.all([
    getProductBySlug(entry.slug).catch(() => null),
    getStoreSettings().catch(() => null),
    headers(),
  ]);
  // The reviews section and the rating markup come from the same approved reviews
  const reviews = product ? await getProductReviewSummary(product.id) : null;
  const faqs = productFaqs(content, entry, product?.price);
  // Cloudflare names the visitor's country; the page says whether and how fast we deliver there
  const visitorCountry = headerList.get("cf-ipcountry")?.trim().toUpperCase() || null;

  const structured = graph(
    organizationSchema({
      supportEmail: settings?.supportEmail,
      supportPhone: settings?.supportPhone,
      legalName: settings?.legalName,
      address: settings?.businessAddress,
      sameAs: settings
        ? [
            settings.facebookEnabled ? settings.facebookUrl : "",
            settings.instagramEnabled ? settings.instagramUrl : "",
            settings.tiktokEnabled ? settings.tiktokUrl : "",
          ]
        : [],
    }),
    websiteSchema(),
    ...(product ? [catalogProductSchema(product, entry, content, reviews)] : []),
    faqSchema(faqs, entry.path),
  );

  return (
    <>
      <JsonLd data={structured} />
      <ProductPage product={product} entry={entry} content={content} faqs={faqs} reviews={reviews} visitorCountry={visitorCountry} />
    </>
  );
}
