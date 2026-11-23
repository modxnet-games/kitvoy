import type { Metadata } from "next";

import { mainProduct } from "@/config/catalog";
import { getProductEntry, type ProductContent } from "@/config/products";
import { siteConfig } from "@/config/site";
import { getProductBySlug } from "@/lib/data/products";
import { getStoreSettings } from "@/lib/data/store-settings";
import { getLocale } from "@/lib/locale-server";
import { productFaqs } from "@/lib/product-faq";
import { publicFileExists } from "@/lib/public-files";
import { catalogProductSchema, faqSchema, graph, organizationSchema, websiteSchema } from "@/lib/seo/structured-data";
import { JsonLd } from "@/components/seo/json-ld";
import { ProductPage } from "@/components/product/product-page";

// Live price and stock, and the visitor's language, are read per request
export const dynamic = "force-dynamic";

const entry = mainProduct;
const page = getProductEntry(entry.slug)!;

/** The copy with only the photos that are on disk: a missing gallery photo is skipped, and the comparison needs both of its photos. */
function withPhotos(content: ProductContent): ProductContent {
  const transformation = content.transformation && publicFileExists(content.transformation.before.src) && publicFileExists(content.transformation.after.src) ? content.transformation : undefined;
  return { ...content, gallery: content.gallery.filter((photo) => publicFileExists(photo.src)), transformation };
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const content = withPhotos(page.content[locale]);
  const image = content.gallery[0];
  const title = `${content.seo.pageTitle} | ${siteConfig.name}`;
  return {
    title: { absolute: title },
    description: content.seo.description,
    alternates: { canonical: "/", languages: { ar: "/?lang=ar", fr: "/?lang=fr" } },
    openGraph: {
      type: "website",
      url: "/",
      siteName: siteConfig.name,
      locale: locale === "ar" ? "ar_MA" : "fr_MA",
      title,
      description: content.seo.description,
      images: image ? [{ url: image.src, alt: image.alt }] : [{ url: siteConfig.ogImage, width: 1200, height: 630, alt: siteConfig.name }],
    },
    twitter: { card: "summary_large_image", title, description: content.seo.description, images: [image?.src ?? siteConfig.ogImage] },
  };
}

/** The store is one product: its page is the home page. */
export default async function HomePage() {
  const [product, settings, locale] = await Promise.all([getProductBySlug(entry.slug).catch(() => null), getStoreSettings().catch(() => null), getLocale()]);
  const content = withPhotos(page.content[locale]);
  const faqs = productFaqs(content, entry, locale, product?.price);

  const structured = graph(
    organizationSchema({
      supportEmail: settings?.supportEmail,
      supportPhone: settings?.supportPhone,
      legalName: settings?.legalName,
      address: settings?.businessAddress,
      sameAs: settings ? [settings.facebookEnabled ? settings.facebookUrl : "", settings.instagramEnabled ? settings.instagramUrl : "", settings.tiktokEnabled ? settings.tiktokUrl : ""] : [],
    }),
    websiteSchema(locale),
    ...(product ? [catalogProductSchema(product, entry, content)] : []),
    faqSchema(faqs, entry.path),
  );

  return (
    <>
      <JsonLd data={structured} />
      <ProductPage product={product} entry={entry} content={content} sizeGuide={page.sizeGuide} faqs={faqs} />
    </>
  );
}
