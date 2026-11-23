/**
 * What a product page says, in each of the store's languages. One file per
 * product in this folder holds its copy; the page template
 * (components/product/product-page.tsx) lays it out. Commerce facts (pack
 * prices, colours, sizes) live in config/catalog.ts.
 *
 * Copy rules, set by the store owner: the product's selling points are stated
 * plainly, with no warnings or caveats added on our own; no invented "was"
 * prices (the only struck figure the page draws is the real cost of the same
 * pieces bought singly), no invented reviews or ratings, no countdowns or
 * stock warnings; no supplier or competitor names.
 */
import type { Locale } from "@/lib/i18n";

/** A feature callout drawn over a gallery photo as a crisp vector pill (never baked into the pixels). */
export interface GalleryBadge {
  icon: "support" | "back" | "adjust" | "shield";
  title: string;
  sub: string;
}

export interface GalleryImage {
  src: string;
  /** Full alt text */
  alt: string;
  /** Callout shown on this photo, on the photos that have one */
  badge?: GalleryBadge;
  /** A dark photo: the watermark and position dots are drawn light on it */
  dark?: boolean;
}

export interface SizeGuideRow {
  size: string;
  /** The usual bra sizes this size fits, in French sizing: "85B", "90C" */
  usual: string[];
}

export interface ProductContent {
  /** Full product name: the <h1>, image alts and structured data */
  name: string;
  /** Small label above the product name, drawn as a pill */
  eyebrow: string;
  /** One line beside the pill, in the display italic */
  tagline: string;
  /** A sentence or two under the product name */
  description: string;
  /** Bullet points that close the buy box */
  features: string[];
  /** The product's own item in the trust row (payment, delivery and exchange are store-wide) */
  trust: string;
  /** The product gallery: five images at most (the template shows no more) */
  gallery: GalleryImage[];
  /** Two photos of one scene, compared with a slider; the section is left out without it */
  transformation?: {
    eyebrow: string;
    heading: string;
    lede: string;
    before: { src: string; alt: string };
    after: { src: string; alt: string };
    beforeLabel: string;
    afterLabel: string;
  };
  howItWorks: { heading: string; steps: { title: string; text: string }[] };
  included: string[];
  /** Specifications, shown as a list and repeated in the structured data */
  facts: { name: string; value: string }[];
  /** Product questions. Delivery, payment and exchange answers are added by the template from the policy config */
  faq: { q: string; a: string }[];
  /** The closing band: one line and the button that leads back up to the buy box */
  closing: { heading: string; cta: string };
  seo: {
    /** <title> */
    pageTitle: string;
    description: string;
    /** The store's own category path */
    category: string;
    material: string;
  };
}

export interface ProductEntry {
  slug: string;
  /** French sizing, shared by both languages */
  sizeGuide: { rows: SizeGuideRow[]; bands: { band: string; underbust: string }[] };
  /** When the page's visible copy last changed (sitemap lastmod) */
  lastModified: string;
  content: Record<Locale, ProductContent>;
  /** The database row this product needs (prisma/seed-catalog.ts) */
  database: { name: string; sku: string; price: number; shortDescription: string; description: string; details: string; categorySlug: string; categoryName: string; stock: number };
}
