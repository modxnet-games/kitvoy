import { INFLATOR_SLUG, SHIPPING_COUNTRY_CODES, productPath, shipsTo, type CatalogProduct } from "@/config/catalog";
import { storePolicies } from "@/config/policies";
import type { ProductContent } from "@/config/products";
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
            areaServed: [...SHIPPING_COUNTRY_CODES],
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
  const path = productPath(INFLATOR_SLUG);
  return {
    "@type": "Product",
    "@id": absolute(`${path}#product`),
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
      url: absolute(path),
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
    applicableCountry: [...SHIPPING_COUNTRY_CODES],
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: storePolicies.returns.windowDays,
    returnMethod: "https://schema.org/ReturnByMail",
    returnFees: "https://schema.org/ReturnFeesCustomerResponsibility",
    refundType: "https://schema.org/FullRefund",
  };
}

/** `path` is the page the questions are printed on. */
export function faqSchema(faqs: { q: string; a: string }[], path = "/") {
  return {
    "@type": "FAQPage",
    "@id": absolute(`${path}#faq`),
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };
}

/** One JSON-LD document holding several linked entities. */
export const graph = (...nodes: object[]) => ({ "@context": "https://schema.org", "@graph": nodes });

/** A numbered list of the catalog's products, for the home and /products pages. */
export function itemListSchema(items: { name: string; path: string }[]) {
  return {
    "@type": "ItemList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      url: absolute(item.path),
    })),
  };
}

/** Free shipping with handling and transit times, once per country the product ships to. */
function shippingDetailsFor(entry: CatalogProduct, freeShipping: boolean) {
  return shipsTo(entry.slug).map((code) => {
    const days = entry.shipping[code]!.days;
    return {
      "@type": "OfferShippingDetails",
      ...(freeShipping ? { shippingRate: { "@type": "MonetaryAmount", value: 0, currency: siteConfig.currency } } : {}),
      shippingDestination: { "@type": "DefinedRegion", addressCountry: code },
      deliveryTime: {
        "@type": "ShippingDeliveryTime",
        handlingTime: { "@type": "QuantitativeValue", minValue: shipping.processingDays.min, maxValue: shipping.processingDays.max, unitCode: "DAY" },
        transitTime: { "@type": "QuantitativeValue", minValue: days.min, maxValue: days.max, unitCode: "DAY" },
      },
    };
  });
}

/**
 * A catalog product on the shared page template (/products/<slug>), with its
 * live price and stock. A product sold in several colours is a ProductGroup
 * whose variants each carry their own SKU, colour, photo and offer, which is
 * the shape Google's merchant listings read; a single-variant product is a
 * plain Product. Rating markup is added only when approved reviews exist.
 */
export function catalogProductSchema(product: ProductDisplay, entry: CatalogProduct, content: ProductContent, reviews?: ReviewSummary | null) {
  const freeShipping = (product.shippingTax ?? 0) === 0;
  const url = absolute(entry.path);
  const gallery = content.gallery.map((g) => absolute(g.src));
  const images = gallery.length ? gallery : product.images.map(absolute);
  const offer = (offerUrl: string) => ({
    "@type": "Offer",
    url: offerUrl,
    priceCurrency: siteConfig.currency,
    price: product.price.toFixed(2),
    availability: product.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    itemCondition: "https://schema.org/NewCondition",
    seller: { "@id": absolute("/#organization") },
    shippingDetails: shippingDetailsFor(entry, freeShipping),
    hasMerchantReturnPolicy: returnPolicySchema(),
  });
  const shared = {
    description: content.seo.summary,
    category: content.seo.category,
    brand: { "@type": "Brand", name: siteConfig.name },
    material: content.seo.material,
    additionalProperty: content.seo.facts.map((f) => ({ "@type": "PropertyValue", name: f.name, value: f.value })),
  };
  const rating = reviews && reviews.count > 0 ? reviewSchema(reviews) : {};

  if (!entry.hasColourChoice) {
    return {
      "@type": "Product",
      "@id": `${url}#product`,
      name: `${siteConfig.name} ${content.name}`,
      ...shared,
      image: images,
      sku: entry.variants[0]?.sku ?? product.sku,
      offers: offer(url),
      ...rating,
    };
  }

  return {
    "@type": "ProductGroup",
    "@id": `${url}#product`,
    name: `${siteConfig.name} ${content.name}`,
    url,
    ...shared,
    image: images,
    productGroupID: product.sku,
    variesBy: ["https://schema.org/color"],
    hasVariant: entry.variants.map((variant) => ({
      "@type": "Product",
      name: `${siteConfig.name} ${content.name}, ${variant.label}`,
      sku: variant.sku,
      color: variant.label,
      image: variant.image ? absolute(variant.image) : images[0],
      offers: offer(`${url}?color=${variant.key}`),
    })),
    ...rating,
  };
}
