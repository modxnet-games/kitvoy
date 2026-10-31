/**
 * Search, structured-data and product-feed copy for the inflator.
 *
 * Facts here are limited to what CJ's supplier listing confirms (checked
 * 2026-10-31: 80 W, ABS, built-in light and warning light, tire pressure
 * gauge, USB charging, 610 g). Its packing list says "tire pump x 1" while the
 * photo shows accessories, so contents are left out. Don't add claims such as
 * auto shut-off or included adapters until the spec sheet confirms them.
 */
export const productSeo = {
  title: "Kitvoy Cordless Tire Inflator",
  /** Homepage <title>; about 50–60 characters with the product phrase first */
  pageTitle: "Cordless Tire Inflator with Digital Gauge | Kitvoy",
  description:
    "Kitvoy cordless tire inflator with a digital pressure gauge, LED light and USB charging. $59.99 with free US shipping. Save on 2- and 3-packs.",
  /** Plain-language summary for the product schema, feed and llms.txt */
  summary:
    "A portable cordless tire inflator for cars, with a built-in tire pressure gauge and digital display, an LED light and warning light, and USB charging. 80 W, ABS housing, 610 g. Ships free within the United States.",
  category: "Car Accessories > Tire Inflators",
  facts: [
    { name: "Power", value: "80 W" },
    { name: "Housing", value: "ABS plastic" },
    { name: "Weight", value: "610 g (1.3 lb)" },
    { name: "Functions", value: "Tire pressure gauge, LED light, warning light" },
    { name: "Charging", value: "USB" },
  ],
} as const;
