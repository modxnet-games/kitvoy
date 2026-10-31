import { productSeo } from "@/config/seo";
import { siteConfig } from "@/config/site";
import type { ProductDisplay } from "@/types/product";

const absolute = (path: string) => new URL(path, siteConfig.url).toString();

/** Brand entity: name, logo and (when published in Store settings) the support email. */
export function organizationSchema(supportEmail?: string) {
  return {
    "@type": "Organization",
    "@id": absolute("/#organization"),
    name: siteConfig.name,
    url: absolute("/"),
    logo: absolute("/apple-icon.png"),
    ...(supportEmail
      ? {
          email: supportEmail,
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            email: supportEmail,
            areaServed: "US",
            availableLanguage: "en",
          },
        }
      : {}),
  };
}

export function websiteSchema() {
  return {
    "@type": "WebSite",
    "@id": absolute("/#website"),
    name: siteConfig.name,
    url: absolute("/"),
    inLanguage: "en-US",
    publisher: { "@id": absolute("/#organization") },
  };
}

/**
 * The inflator with its live price and stock. No rating markup: the store has
 * no reviews yet, and Google penalizes ratings that aren't backed by reviews.
 */
export function productSchema(product: ProductDisplay) {
  const freeShipping = (product.shippingTax ?? 0) === 0;
  return {
    "@type": "Product",
    "@id": absolute("/#product"),
    name: productSeo.title,
    description: productSeo.summary,
    image: product.images.map(absolute),
    sku: product.sku,
    category: productSeo.category,
    brand: { "@type": "Brand", name: siteConfig.name },
    additionalProperty: productSeo.facts.map((f) => ({ "@type": "PropertyValue", name: f.name, value: f.value })),
    offers: {
      "@type": "Offer",
      url: absolute("/"),
      priceCurrency: siteConfig.currency,
      price: product.price.toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": absolute("/#organization") },
      ...(freeShipping
        ? {
            shippingDetails: {
              "@type": "OfferShippingDetails",
              shippingRate: { "@type": "MonetaryAmount", value: 0, currency: siteConfig.currency },
              shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
            },
          }
        : {}),
    },
  };
}

export function faqSchema(faqs: { q: string; a: string }[]) {
  return {
    "@type": "FAQPage",
    "@id": absolute("/#faq"),
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** One JSON-LD document holding several linked entities. */
export const graph = (...nodes: object[]) => ({ "@context": "https://schema.org", "@graph": nodes });
