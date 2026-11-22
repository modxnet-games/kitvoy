/**
 * The Chrilik catalog: the product the store sells.
 *
 * This file holds the commerce facts every layer shares (cart, order pricing,
 * checkout, tracking): the pack prices, the colours and the sizes. Page copy
 * lives next to it in `config/products/`.
 *
 * It is plain data with no server imports, so client components can read it.
 *
 * The store is a single product page at "/". Selling a second product means a
 * second entry here, a content file in `config/products/`, a database row with
 * the same slug (prisma/seed-catalog.ts) and a page for it.
 */
import type { Locale } from "@/lib/i18n";

/** Morocco only, cash on delivery */
export const SHIPPING_COUNTRY = "MA";

export interface BundleTier {
  quantity: number;
  /** Fraction off the line total, e.g. 0.25 = 25% off */
  discount: number;
  /**
   * Fixed dirhams off the line total. Alone, it is the tier's discount. With a
   * `discount` as well, it applies to exactly `quantity` units (a round pack
   * price) and the percentage applies to anything above that.
   */
  amountOff?: number;
  /** Which badge the pack carries on the page, if any */
  badge?: "popular" | "best";
}

type Localised = Record<Locale, string>;

export interface CatalogColour {
  /** Stable key, the first half of a variant key: "black" */
  key: string;
  label: Localised;
  /** Swatch for the selector */
  swatch: string;
  /** A second swatch colour for a print (the leopard's spots) */
  swatchDots?: string;
  /** Short code inside the SKU */
  code: string;
  /** Photo of this colour */
  image: string;
}

/** One colour in one size: what a cart line and an order line are for. */
export interface CatalogVariant {
  /** Stored on the order line: "black-xl" */
  key: string;
  colour: CatalogColour;
  size: string;
  /** The store's SKU, also the id sent to Meta: "SND-BLK-XL" */
  sku: string;
  image: string;
}

export interface CatalogProduct {
  /** Database product slug */
  slug: string;
  /** Where the product page lives */
  path: string;
  /** Short name for the admin, links and lists */
  shortName: string;
  /** The name customers read in the cart and the order summary */
  displayName: Record<Locale, string>;
  /** "pièce" / "pièces" */
  unit: Record<Locale, { one: string; many: string }>;
  tiers: BundleTier[];
  /** No pack may take more than this fraction off, whatever price the admin sets */
  maxDiscount: number;
  colours: CatalogColour[];
  sizes: string[];
  /** Prefix of every SKU of the product */
  skuPrefix: string;
  /** Days from the confirmation call to the door, as promised on the page */
  deliveryHours: { min: number; max: number };
  /** Sent to Meta as content_category */
  metaCategory: string;
}

export const catalog: CatalogProduct[] = [
  {
    slug: "sanadi",
    path: "/",
    shortName: "Sanadi",
    displayName: { ar: "سندي", fr: "Sanadi" },
    unit: { ar: { one: "قطعة", many: "قطع" }, fr: { one: "pièce", many: "pièces" } },
    // 199 DH each: 2 for 350 DH, 3 for 450 DH, and 25% off each from the fourth
    tiers: [
      { quantity: 1, discount: 0 },
      { quantity: 2, discount: 0, amountOff: 48, badge: "popular" },
      { quantity: 3, discount: 0.25, amountOff: 147, badge: "best" },
    ],
    maxDiscount: 0.3,
    colours: [
      { key: "black", label: { ar: "أسود", fr: "Noir" }, swatch: "#1D1B1A", code: "BLK", image: "/products/sanadi/colour-black.webp" },
      { key: "nude", label: { ar: "بيج", fr: "Beige" }, swatch: "#E3C3A4", code: "NUD", image: "/products/sanadi/colour-nude.webp" },
      { key: "leopard", label: { ar: "نمري", fr: "Léopard" }, swatch: "#8A4B2F", swatchDots: "#2A1710", code: "LEO", image: "/products/sanadi/colour-leopard.webp" },
    ],
    sizes: ["S", "M", "L", "XL", "XXL", "XXXL"],
    skuPrefix: "SND",
    deliveryHours: { min: 24, max: 72 },
    metaCategory: "Lingerie",
  },
];

/** The store's product: the one the home page sells. */
export const mainProduct = catalog[0];

const bySlug = new Map(catalog.map((p) => [p.slug, p]));

export function getCatalogProduct(slug: string | null | undefined): CatalogProduct | undefined {
  return slug ? bySlug.get(slug) : undefined;
}

/** Where a product's page is; a product the catalog doesn't know goes to the storefront. */
export function productPath(slug: string | null | undefined): string {
  return getCatalogProduct(slug)?.path ?? "/";
}

export function variantKey(colourKey: string, size: string): string {
  return `${colourKey}-${size.toLowerCase()}`;
}

/** The colour and size a variant key names, or undefined when the product has no such variant. */
export function getCatalogVariant(slug: string | null | undefined, key: string | null | undefined): CatalogVariant | undefined {
  const product = getCatalogProduct(slug);
  if (!product || !key) return undefined;
  const cut = key.lastIndexOf("-");
  if (cut < 1) return undefined;
  const colour = product.colours.find((c) => c.key === key.slice(0, cut));
  const size = product.sizes.find((s) => s.toLowerCase() === key.slice(cut + 1));
  if (!colour || !size) return undefined;
  return { key: variantKey(colour.key, size), colour, size, sku: `${product.skuPrefix}-${colour.code}-${size}`, image: colour.image };
}

/** "Noir · XL" / "أسود · XL" */
export function variantLabel(variant: CatalogVariant, locale: Locale): string {
  return `${variant.colour.label[locale]} · ${variant.size}`;
}
