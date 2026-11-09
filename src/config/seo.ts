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
  /** Homepage <title>; about 50–60 characters with the product phrase first */
  pageTitle: "Cordless Tire Inflator with Digital Gauge | Kitvoy",
  description:
    "Kitvoy cordless tire inflator with a digital pressure gauge, LED light and USB charging. $59.99 with free US shipping. Save on 2- and 3-packs.",
  /** Plain-language summary for the product schema, feed and llms.txt */
  summary:
    "A compact cordless tire inflator for cars, with a digital pressure gauge, an integrated LED light and a USB charging cable. 80 W of power in an ABS housing that weighs 610 g. Ships free within the United States.",
  category: "Car Accessories > Tire Inflators",
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
 * When each page's visible copy last changed, for the sitemap's lastmod.
 * Bump a date only when what a visitor reads on that page changes: not for
 * styling, tracking or refactors. Product edits made in the admin and newly
 * published reviews move the homepage's date on their own (see sitemap.ts).
 */
export const pageLastModified = {
  /** Landing copy, FAQ and bundle pricing (2-pack lead offer) */
  home: "2026-11-02",
  /** Help page: privacy paragraph now mentions ad measurement */
  support: "2026-11-03",
} as const;

/** The product's database copy, matching the verified specs above. */
export const verifiedProductCopy = {
  shortDescription: "A compact cordless tire inflator with a digital pressure gauge, an integrated LED light and USB charging.",
  description:
    "Keep a compact tire inflator in the car for low-pressure mornings. The digital pressure gauge shows the reading while you inflate, the integrated LED light helps at night, and it recharges with the included USB charging cable. 80 W of power in an ABS housing that weighs just 610 g.",
  details: "• 80 W power\n• ABS housing\n• Digital pressure gauge\n• Integrated LED light\n• USB charging cable\n• Compact 610 g weight",
} as const;
