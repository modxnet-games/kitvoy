/**
 * The Kitvoy catalog: one entry per product the store sells.
 *
 * This file holds the commerce facts every layer shares (cart, order pricing,
 * checkout, tracking): where the product lives on the site, its bundle
 * prices, the colours it comes in and the countries it ships to. Page copy
 * lives next to it in `config/products/`.
 *
 * It is plain data with no server imports, so client components can read it.
 *
 * Adding a product: add an entry here, a content file in `config/products/`,
 * and a database row with the same slug (see prisma/seed-catalog.ts). The
 * price itself is the database product's price, edited in the admin.
 */

/** Countries the store can ship to. Brazil is left out on purpose (CPF and customs). */
export const SHIPPING_COUNTRY_CODES = ["US", "GB", "DE", "FR", "NL", "ES", "MX", "CL"] as const;
export type CountryCode = (typeof SHIPPING_COUNTRY_CODES)[number];

export interface BundleTier {
  quantity: number;
  /** Fraction off the line total, e.g. 0.25 = 25% off */
  discount: number;
  /**
   * Fixed dollars off the line total. Alone, it is the tier's discount. With a
   * `discount` as well, it applies to exactly `quantity` units (a round pack
   * price) and the percentage applies to anything above that.
   */
  amountOff?: number;
  label: string;
  badge?: string;
}

export interface CatalogVariant {
  /** Stable key stored on the order line, e.g. "blue" */
  key: string;
  /** Shown to customers, e.g. "Blue" */
  label: string;
  /** Swatch colour for the selector */
  swatch: string;
  /** The store's own SKU for this colour; also the id sent to Meta */
  sku: string;
  /** Photo of this colour, when the product has one */
  image?: string;
}

export interface CountryShipping {
  /** CJ logistics line used for this country; must be one CJ offers for the variant */
  method: string;
  /** Days in transit once shipped, as quoted by CJ */
  days: { min: number; max: number };
  /** CJ's quote in USD for 1, 2 and 3 units (used for profit estimates only) */
  cost: [number, number, number];
}

export interface CatalogProduct {
  /** Database product slug */
  slug: string;
  /** Where the product page lives */
  path: string;
  /** Short name for links and lists */
  shortName: string;
  /** "1 ball", "2 balls" */
  unit: { one: string; many: string };
  tiers: BundleTier[];
  /** No bundle may take more than this fraction off, whatever price the admin sets */
  maxDiscount: number;
  /** The customer picks a colour; false when there is only one variant */
  hasColourChoice: boolean;
  variants: CatalogVariant[];
  shipping: Partial<Record<CountryCode, CountryShipping>>;
  /** Sent to Meta as content_category so the pixel learns each niche apart */
  metaCategory: string;
}

export const catalog: CatalogProduct[] = [
  {
    slug: "pouncepop",
    path: "/products/pouncepop",
    shortName: "PouncePop",
    unit: { one: "ball", many: "balls" },
    // $29.99 each: 2 for $49.99, 3 for $64.99, and 25% off each from the fourth
    tiers: [
      { quantity: 1, discount: 0, label: "1 ball" },
      { quantity: 2, discount: 0, amountOff: 9.99, label: "2 balls", badge: "Most popular" },
      { quantity: 3, discount: 0.25, amountOff: 24.98, label: "3 balls", badge: "Best value" },
    ],
    maxDiscount: 0.3,
    hasColourChoice: true,
    variants: [
      {
        key: "orange",
        label: "Orange",
        swatch: "#F5821F",
        sku: "PET-001-OR",
        image: "/products/pouncepop/variant-orange.webp",
      },
      {
        key: "purple",
        label: "Purple",
        swatch: "#8B6FD6",
        sku: "PET-001-PU",
        image: "/products/pouncepop/variant-purple.webp",
      },
      {
        key: "blue",
        label: "Blue",
        swatch: "#1F3FBF",
        sku: "PET-001-BL",
        image: "/products/pouncepop/variant-blue.webp",
      },
    ],
    // CJ freight quotes, China warehouse, 2026-11-12 (ad-production/petball/cj-freight-2026-11-12.json)
    shipping: {
      US: { method: "CJPacket Sensitive", days: { min: 4, max: 9 }, cost: [5.66, 6.49, 7.7] },
      GB: { method: "CJPacket Special line", days: { min: 5, max: 9 }, cost: [3.67, 4.36, 5.05] },
      DE: { method: "CJPacket Eub Special Line", days: { min: 8, max: 12 }, cost: [5.56, 6.84, 8.11] },
      FR: { method: "CJPacket Sensitive", days: { min: 7, max: 12 }, cost: [11.28, 12.12, 12.95] },
      NL: { method: "CJPacket Sensitive", days: { min: 4, max: 7 }, cost: [10.97, 11.85, 12.75] },
      ES: { method: "CJPacket Eub Special Line", days: { min: 13, max: 16 }, cost: [4.16, 5.34, 6.51] },
      MX: { method: "CJPacket Latin America Sensitive", days: { min: 7, max: 11 }, cost: [4.16, 5.28, 6.38] },
      CL: { method: "CJPacket Latin America Sensitive", days: { min: 9, max: 13 }, cost: [7.5, 8.5, 9.49] },
    },
    metaCategory: "Pet Care",
  },
];

const bySlug = new Map(catalog.map((p) => [p.slug, p]));

export function getCatalogProduct(slug: string | null | undefined): CatalogProduct | undefined {
  return slug ? bySlug.get(slug) : undefined;
}

/** Where a product's page is; a product the catalog doesn't know goes to the storefront. */
export function productPath(slug: string | null | undefined): string {
  return getCatalogProduct(slug)?.path ?? "/";
}

/** The colour a line was bought in, or the product's only variant when it has no colour choice. */
export function getCatalogVariant(slug: string | null | undefined, variantKey: string | null | undefined): CatalogVariant | undefined {
  const product = getCatalogProduct(slug);
  if (!product) return undefined;
  if (variantKey) return product.variants.find((v) => v.key === variantKey);
  return product.hasColourChoice ? undefined : product.variants[0];
}

/** Countries a product ships to, in the store's display order. */
export function shipsTo(slug: string | null | undefined): CountryCode[] {
  const product = getCatalogProduct(slug);
  // A product outside the catalog keeps the store's original rule: United States only
  if (!product) return ["US"];
  return SHIPPING_COUNTRY_CODES.filter((code) => product.shipping[code]);
}

/** Countries every product in a cart ships to. */
export function countriesForCart(slugs: (string | null | undefined)[]): CountryCode[] {
  if (slugs.length === 0) return ["US"];
  return SHIPPING_COUNTRY_CODES.filter((code) => slugs.every((slug) => shipsTo(slug).includes(code)));
}
