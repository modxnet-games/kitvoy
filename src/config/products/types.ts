/**
 * What a product page says. One file per product in this folder holds its
 * copy; the page template (components/product/product-page.tsx) lays it out.
 * Commerce facts (price tiers, colours, countries) live in config/catalog.ts.
 *
 * Copy rules: product specs come from the store owner's confirmed spec for
 * the product (recorded at the top of its file); no strike-through or "was"
 * prices, no invented reviews or ratings, no countdowns or stock warnings.
 */

export type IconName =
  | "sparkles"
  | "zap"
  | "shield"
  | "battery"
  | "paw"
  | "ruler"
  | "truck"
  | "package"
  | "power"
  | "play"
  | "hand";

export interface GalleryImage {
  src: string;
  /** Full alt text */
  alt: string;
  /** Short label under the thumbnail */
  label: string;
}

/**
 * A short looping demo clip. `src` stays null until a real clip of the product
 * is recorded; the slot then shows its still image and caption, never an empty
 * player. Bind a clip by putting an .mp4 (and optional .webm) under /public
 * and setting `src`.
 */
export interface DemoLoop {
  id: string;
  title: string;
  caption: string;
  /** MP4 URL of the loop, or null while there is none */
  src: string | null;
  /** Optional WebM of the same loop */
  webm?: string | null;
  /** Still shown before the clip loads, and in its place while `src` is null */
  poster: string;
  posterAlt: string;
}

export interface ProductContent {
  slug: string;
  /** Full product name, used in the <h1> eyebrow, image alts and structured data */
  name: string;
  /** Small label above the headline */
  eyebrow: string;
  /** The hook */
  headline: string;
  subheadline: string;
  /** Four scannable benefits under the headline */
  benefits: { icon: IconName; title: string; text: string }[];
  /** The product gallery: five images at most (the template shows no more) */
  gallery: GalleryImage[];
  demoLoops: DemoLoop[];
  /** Heading above the bundle cards */
  bundle: { heading: string; intro: string; tierNotes: Record<number, string> };
  howItWorks: { heading: string; steps: { icon: IconName; title: string; text: string }[]; tip?: string };
  comparison: {
    heading: string;
    ours: string;
    theirs: string;
    rows: { feature: string; ours: string; theirs: string }[];
  };
  included: { heading: string; items: string[]; image: string; imageAlt: string };
  /** Longer benefit sections, each beside an image */
  story: { heading: string; text: string; image: string; imageAlt: string }[];
  /** Product questions. Shipping and returns answers are added by the template from the policy config */
  faq: { q: string; a: string }[];
  seo: {
    /** <title>, product phrase first, about 50–60 characters */
    pageTitle: string;
    description: string;
    /** Plain-language summary for the product schema and llms.txt */
    summary: string;
    /** The store's own category path */
    category: string;
    /** Google's product taxonomy path, for the Merchant feed */
    googleCategory: string;
    material: string;
    /** Facts stated in visible text on the page (the specifications answer) and repeated in the markup */
    facts: { name: string; value: string }[];
    /** When the page's visible copy last changed (sitemap lastmod) */
    lastModified: string;
  };
  merchant: {
    /**
     * List the product in the Google Merchant Center feed. Keep false until its
     * photos meet Google's image rules (AI-generated images must carry the IPTC
     * "trained algorithmic media" tag) and the owner has checked the listing.
     */
    inFeed: boolean;
    /** Up to 150 characters, no price, shipping or promotional wording */
    title: string;
    description: string;
    highlights: string[];
    weightGrams: number;
  };
  /** Database copy, kept in step with the verified facts (see prisma/seed-catalog.ts) */
  database: { name: string; sku: string; price: number; shortDescription: string; description: string; details: string; categorySlug: string; categoryName: string; stock: number };
}
