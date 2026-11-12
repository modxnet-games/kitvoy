/**
 * Search, structured-data and product-feed copy for the inflator.
 *
 * Facts here are limited to the supplier-verified specs (CJ listing, checked
 * 2026-10-31): 80 W, ABS housing, digital pressure gauge, integrated LED
 * light, USB charging cable, 610 g. The database product description says the
 * same. Don't add claims such as auto shut-off, USB-C, SOS mode or included
 * nozzle adapters until the spec sheet confirms them.
 */
export const productSeo = {
  title: "Kitvoy Cordless Tire Inflator",
  /**
   * Homepage <title>; about 50–60 characters with the product phrase first.
   * It names the product both ways shoppers search for it: a tire inflator
   * and a portable air compressor.
   */
  pageTitle: "Cordless Tire Inflator – Portable Air Compressor | Kitvoy",
  description:
    "Kitvoy cordless tire inflator: a portable air compressor with a digital pressure gauge, LED light and USB charging. $59.99 with free US shipping.",
  /** Plain-language summary for the product schema and llms.txt */
  summary:
    "A compact cordless tire inflator for cars, with a digital pressure gauge, an integrated LED light and a USB charging cable. 80 W of power in an ABS housing that weighs 610 g. Ships free within the United States.",
  /** The store's own category path (schema.org category and the feed's product_type) */
  category: "Vehicle Parts & Accessories > Tire Care > Tire Inflators & Portable Air Compressors",
  facts: [
    { name: "Power", value: "80 W" },
    { name: "Housing", value: "ABS" },
    { name: "Pressure gauge", value: "Digital" },
    { name: "Light", value: "Integrated LED" },
    { name: "Charging", value: "USB charging cable" },
    { name: "Weight", value: "610 g (1.3 lb)" },
  ],
} as const;

/**
 * Google Merchant Center listing copy, for the feed at /feeds/google-merchant.xml.
 * Shopping matches searches against the title and description, so they name
 * the product the ways shoppers do (tire inflator, portable air compressor,
 * tire pump) and list its features. Google's rules for these fields: no price,
 * shipping or promotional wording, and nothing the product page doesn't also
 * say. The fact limits above apply here too.
 */
export const merchantListing = {
  /** Up to 150 characters; listings show roughly the first 70, so the product name leads */
  title: "Kitvoy Cordless Tire Inflator, Portable Air Compressor for Car & Motorcycle Tires – Digital Pressure Gauge, LED Light, USB Rechargeable",
  description:
    "The Kitvoy Cordless Tire Inflator is a compact, portable air compressor for topping up car and motorcycle tires at home or on the road. Set your target pressure with the + and − buttons, press start, and follow the reading on the digital pressure gauge as the tire fills. It runs on a rechargeable battery, so you can top up a tire wherever you are parked, and it recharges with the included USB charging cable. An integrated LED light helps when you check a tire after dark. 80 W of power in an ABS housing that weighs 610 g (1.3 lb), so this tire pump is easy to keep in the car. Includes the inflator, its air hose and a USB charging cable. An inflator adds air to a low tire; it cannot repair a punctured or damaged one.",
  /** Short bullets shown on the listing: 2 to 10, each up to 150 characters */
  highlights: [
    "Digital pressure gauge shows the reading as the tire fills",
    "Set your target pressure with the + and − buttons, then press start",
    "Cordless: runs on a rechargeable battery and recharges over USB",
    "Integrated LED light for checking a tire after dark",
    "Compact ABS housing weighs 610 g (1.3 lb), easy to keep in the car",
    "Made for car and motorcycle tires",
    "Comes with its air hose and a USB charging cable",
  ],
  material: "ABS",
  weightGrams: 610,
} as const;

/**
 * When each page's visible copy last changed, for the sitemap's lastmod.
 * Bump a date only when what a visitor reads on that page changes: not for
 * styling, tracking or refactors. Product edits made in the admin and newly
 * published reviews move the homepage's date on their own (see sitemap.ts).
 */
export const pageLastModified = {
  /** The inflator's landing copy and FAQ (now at /inflator): also named as a portable air compressor, with its specs listed */
  home: "2026-11-10",
  /** The storefront home and the /products catalog: first published with the multi-product store */
  catalog: "2026-11-12",
  /** Help page: payments are by Stripe and PayPal; who operates the store, when published */
  support: "2026-11-10",
} as const;

/** The product's database copy, matching the verified specs above. */
export const verifiedProductCopy = {
  shortDescription: "A compact cordless tire inflator with a digital pressure gauge, an integrated LED light and USB charging.",
  description:
    "Keep a compact tire inflator in the car for low-pressure mornings. The digital pressure gauge shows the reading while you inflate, the integrated LED light helps at night, and it recharges with the included USB charging cable. 80 W of power in an ABS housing that weighs just 610 g.",
  details: "• 80 W power\n• ABS housing\n• Digital pressure gauge\n• Integrated LED light\n• USB charging cable\n• Compact 610 g weight",
} as const;
