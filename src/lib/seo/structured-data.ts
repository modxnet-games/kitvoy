import { SHIPPING_COUNTRY, getCatalogVariant, variantKey, type CatalogProduct } from "@/config/catalog";
import { storePolicies } from "@/config/policies";
import type { ProductContent } from "@/config/products";
import { siteConfig } from "@/config/site";
import type { Locale } from "@/lib/i18n";
import type { ProductDisplay } from "@/types/product";

/*
 * schema.org markup for search engines. Everything stated here is also said in
 * visible text on the page: the price, the free delivery in Morocco, payment
 * on delivery and the size exchange. No ratings or reviews are claimed.
 */

const abs = (path: string) => new URL(path, siteConfig.url).toString();
const ORG_ID = abs("/#organization");
const SITE_ID = abs("/#website");

export interface OrganizationDetails {
  supportEmail?: string | null;
  supportPhone?: string | null;
  legalName?: string | null;
  address?: string | null;
  /** Social profile URLs; empty ones are dropped */
  sameAs?: string[];
}

export function organizationSchema(details: OrganizationDetails = {}) {
  const sameAs = (details.sameAs ?? []).filter(Boolean);
  return {
    "@type": "Organization",
    "@id": ORG_ID,
    name: siteConfig.name,
    alternateName: siteConfig.nameAr,
    url: abs("/"),
    logo: abs("/brand/chrilik-logo-512.png"),
    ...(details.legalName && { legalName: details.legalName }),
    ...(details.address && { address: details.address }),
    ...(sameAs.length > 0 && { sameAs }),
    ...((details.supportEmail || details.supportPhone) && {
      contactPoint: [
        {
          "@type": "ContactPoint",
          contactType: "customer service",
          ...(details.supportEmail && { email: details.supportEmail }),
          ...(details.supportPhone && { telephone: details.supportPhone }),
          areaServed: SHIPPING_COUNTRY,
          availableLanguage: ["ar", "fr"],
        },
      ],
    }),
  };
}

export function websiteSchema(locale: Locale) {
  return {
    "@type": "WebSite",
    "@id": SITE_ID,
    url: abs("/"),
    name: siteConfig.name,
    inLanguage: locale === "ar" ? "ar-MA" : "fr-MA",
    publisher: { "@id": ORG_ID },
  };
}

/** A size can be swapped within the exchange window; the customer sends the piece back by courier. */
export function returnPolicySchema() {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: SHIPPING_COUNTRY,
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: storePolicies.exchange.windowDays,
    returnMethod: "https://schema.org/ReturnByMail",
    merchantReturnLink: abs("/returns"),
  };
}

export function faqSchema(faqs: { q: string; a: string }[], path = "/") {
  return {
    "@type": "FAQPage",
    "@id": abs(`${path}#faq`),
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.q,
      acceptedAnswer: { "@type": "Answer", text: faq.a },
    })),
  };
}

export const graph = (...nodes: object[]) => ({ "@context": "https://schema.org", "@graph": nodes });

function shippingDetails(entry: CatalogProduct, shippingTax: number) {
  const days = { min: Math.floor(entry.deliveryHours.min / 24), max: Math.ceil(entry.deliveryHours.max / 24) };
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: shippingTax, currency: siteConfig.currency },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: SHIPPING_COUNTRY },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: 0, maxValue: 1, unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: days.min, maxValue: days.max, unitCode: "DAY" },
    },
  };
}

/** The product, with one offer per colour and size at the single-piece price. */
export function catalogProductSchema(product: ProductDisplay, entry: CatalogProduct, content: ProductContent) {
  const shippingTax = product.shippingTax ?? 0;
  const availability = product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock";
  const offer = (sku: string) => ({
    "@type": "Offer",
    url: abs(entry.path),
    sku,
    price: product.price,
    priceCurrency: siteConfig.currency,
    availability,
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@id": ORG_ID },
    shippingDetails: shippingDetails(entry, shippingTax),
    hasMerchantReturnPolicy: returnPolicySchema(),
  });
  const variants = entry.colours.flatMap((colour) => entry.sizes.flatMap((size) => getCatalogVariant(entry.slug, variantKey(colour.key, size)) ?? []));
  return {
    "@type": "Product",
    "@id": abs(`${entry.path}#product`),
    name: content.name,
    description: content.seo.description,
    sku: product.sku,
    category: content.seo.category,
    material: content.seo.material,
    brand: { "@type": "Brand", name: siteConfig.name },
    image: content.gallery.map((g) => abs(g.src)),
    additionalProperty: content.facts.map((fact) => ({ "@type": "PropertyValue", name: fact.name, value: fact.value })),
    offers: variants.length > 0 ? variants.map((v) => offer(v.sku)) : [offer(product.sku)],
  };
}
