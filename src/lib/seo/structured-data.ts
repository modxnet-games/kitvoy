import { storePolicies } from "@/config/policies";
import { merchantListing, productSeo } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { REVIEWS_SHOWN_FIRST, type ReviewSummary } from "@/lib/reviews";
import type { ProductDisplay } from "@/types/product";

const absolute = (path: string) => new URL(path, siteConfig.url).toString();
const { shipping } = storePolicies;

/** What Store settings publish about the business; every field is optional and left out when empty. */
export interface OrganizationDetails {
  supportEmail?: string;
  supportPhone?: string;
  /** The registered business that operates the store */
  legalName?: string;
  /** Its address, on one line */
  address?: string;
  /** The store's own social profiles */
  sameAs?: string[];
}

/** Brand entity: name, logo, and whatever contact and business details Store settings publish. */
export function organizationSchema(details: OrganizationDetails = {}) {
  const supportEmail = details.supportEmail?.trim() || undefined;
  const supportPhone = details.supportPhone?.trim() || undefined;
  const legalName = details.legalName?.trim() || undefined;
  const address = details.address?.trim() || undefined;
  const sameAs = (details.sameAs ?? []).map((u) => u.trim()).filter((u) => /^https:\/\//.test(u));
  return {
    "@type": "Organization",
    "@id": absolute("/#organization"),
    name: siteConfig.name,
    ...(legalName ? { legalName } : {}),
    url: absolute("/"),
    logo: absolute("/apple-icon.png"),
    ...(address ? { address } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    hasMerchantReturnPolicy: returnPolicySchema(),
    ...(supportEmail ? { email: supportEmail } : {}),
    ...(supportPhone ? { telephone: supportPhone } : {}),
    ...(supportEmail || supportPhone
      ? {
          contactPoint: {
            "@type": "ContactPoint",
            contactType: "customer support",
            ...(supportEmail ? { email: supportEmail } : {}),
            ...(supportPhone ? { telephone: supportPhone } : {}),
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
 * The inflator with its live price and stock. Rating markup is added only when
 * approved reviews exist, from the same reviews the landing page shows; Google
 * penalizes ratings that aren't backed by reviews on the page.
 */
export function productSchema(product: ProductDisplay, reviews?: ReviewSummary | null) {
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
    material: merchantListing.material,
    additionalProperty: productSeo.facts.map((f) => ({ "@type": "PropertyValue", name: f.name, value: f.value })),
    offers: {
      "@type": "Offer",
      url: absolute("/"),
      priceCurrency: siteConfig.currency,
      price: product.price.toFixed(2),
      availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": absolute("/#organization") },
      shippingDetails: {
        "@type": "OfferShippingDetails",
        ...(freeShipping ? { shippingRate: { "@type": "MonetaryAmount", value: 0, currency: siteConfig.currency } } : {}),
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "US" },
        deliveryTime: {
          "@type": "ShippingDeliveryTime",
          handlingTime: { "@type": "QuantitativeValue", minValue: shipping.processingDays.min, maxValue: shipping.processingDays.max, unitCode: "DAY" },
          transitTime: { "@type": "QuantitativeValue", minValue: shipping.deliveryDays.min, maxValue: shipping.deliveryDays.max, unitCode: "DAY" },
        },
      },
      hasMerchantReturnPolicy: returnPolicySchema(),
    },
    ...(reviews && reviews.count > 0 ? reviewSchema(reviews) : {}),
  };
}

/** aggregateRating over every approved review, and the reviews shown first on the page. */
export function reviewSchema(reviews: ReviewSummary) {
  return {
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: reviews.average,
      reviewCount: reviews.count,
      bestRating: 5,
      worstRating: 1,
    },
    review: reviews.reviews.slice(0, REVIEWS_SHOWN_FIRST).map((r) => ({
      "@type": "Review",
      author: { "@type": "Person", name: r.author },
      datePublished: r.publishedOn,
      reviewBody: r.comment,
      reviewRating: { "@type": "Rating", ratingValue: r.rating, bestRating: 5, worstRating: 1 },
    })),
  };
}

/** The 30-day policy at /returns: unused items by mail; change-of-mind return shipping is the customer's. */
export function returnPolicySchema() {
  return {
    "@type": "MerchantReturnPolicy",
    url: absolute("/returns"),
    applicableCountry: "US",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: storePolicies.returns.windowDays,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    refundType: "https://schema.org/FullRefund",
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
