import { INFLATOR_SLUG, productPath, shipsTo, type CatalogProduct } from "@/config/catalog";
import { storePolicies } from "@/config/policies";
import type { ProductContent } from "@/config/products";
import { merchantListing, productSeo } from "@/config/seo";
import { siteConfig } from "@/config/site";

/**
 * The Google Merchant Center product feed (RSS 2.0 with the g: namespace),
 * built from the live product. Microsoft Merchant Center reads the same format.
 *
 * What goes in follows Google's product data specification:
 *  - title and description name the product the ways shoppers search for it;
 *  - no price, shipping or promotional wording in either (those have their own
 *    attributes);
 *  - identifier_exists is "no": the inflator has no GTIN or manufacturer part
 *    number, and inventing one gets a listing disapproved;
 *  - google_product_category is left to Google, which assigns it from the
 *    title, description and product_type.
 */

export interface FeedProduct {
  sku: string;
  price: number;
  stock: number;
  shippingTax?: number | null;
  images: string[];
}

const { shipping } = storePolicies;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const absolute = (path: string) => new URL(path, siteConfig.url).toString();
const money = (amount: number) => `${amount.toFixed(2)} ${siteConfig.currency}`;

/**
 * Where a click on the listing lands: the product page, tagged so the order's
 * attribution shows it came from Google Shopping. The page's canonical is the
 * same path without the tags, which the feed also states as canonical_link.
 */
export function merchantLandingUrl(path: string = productPath(INFLATOR_SLUG), extra: Record<string, string> = {}): string {
  const url = new URL(path, siteConfig.url);
  for (const [key, value] of Object.entries(extra)) url.searchParams.set(key, value);
  url.searchParams.set("utm_source", "google");
  url.searchParams.set("utm_medium", "shopping");
  url.searchParams.set("utm_campaign", "merchant_feed");
  return url.toString();
}

/** One <item>: the single inflator at its live price and stock. */
export function merchantFeedItem(product: FeedProduct): string {
  const [mainImage, ...moreImages] = product.images;
  const lines = [
    `<g:id>${esc(product.sku)}</g:id>`,
    `<g:title>${esc(merchantListing.title)}</g:title>`,
    `<g:description>${esc(merchantListing.description)}</g:description>`,
    `<g:link>${esc(merchantLandingUrl())}</g:link>`,
    `<g:canonical_link>${esc(absolute(productPath(INFLATOR_SLUG)))}</g:canonical_link>`,
    `<g:image_link>${esc(absolute(mainImage ?? siteConfig.ogImage))}</g:image_link>`,
    ...moreImages.slice(0, 10).map((src) => `<g:additional_image_link>${esc(absolute(src))}</g:additional_image_link>`),
    `<g:availability>${product.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability>`,
    `<g:price>${money(product.price)}</g:price>`,
    `<g:brand>${esc(siteConfig.name)}</g:brand>`,
    `<g:condition>new</g:condition>`,
    `<g:identifier_exists>no</g:identifier_exists>`,
    `<g:product_type>${esc(productSeo.category)}</g:product_type>`,
    `<g:material>${esc(merchantListing.material)}</g:material>`,
    `<g:product_weight>${merchantListing.weightGrams} g</g:product_weight>`,
    ...merchantListing.highlights.map((h) => `<g:product_highlight>${esc(h)}</g:product_highlight>`),
    ...productSeo.facts.map(
      (f) =>
        `<g:product_detail><g:section_name>Specifications</g:section_name><g:attribute_name>${esc(f.name)}</g:attribute_name><g:attribute_value>${esc(f.value)}</g:attribute_value></g:product_detail>`,
    ),
    `<g:shipping><g:country>US</g:country><g:price>${money(product.shippingTax ?? 0)}</g:price><g:min_handling_time>${shipping.processingDays.min}</g:min_handling_time><g:max_handling_time>${shipping.processingDays.max}</g:max_handling_time><g:min_transit_time>${shipping.deliveryDays.min}</g:min_transit_time><g:max_transit_time>${shipping.deliveryDays.max}</g:max_transit_time></g:shipping>`,
  ];
  return `    <item>\n${lines.map((l) => `      ${l}`).join("\n")}\n    </item>`;
}

/**
 * Feed items for a catalog product on the shared page template: one <item>
 * per colour, tied together by item_group_id, each landing on the product
 * page with its colour picked. Same rules as the inflator's item: nothing the
 * page doesn't say, no invented identifiers.
 */
export function catalogFeedItems(product: FeedProduct, entry: CatalogProduct, content: ProductContent): string[] {
  const usDays = entry.shipping.US?.days ?? shipping.deliveryDays;
  const ships = shipsTo(entry.slug).includes("US");
  return entry.variants.map((variant) => {
    const tags = { utm_source: "google", utm_medium: "shopping", utm_campaign: "merchant_feed" };
    const landing = entry.hasColourChoice ? merchantLandingUrl(entry.path, { colour: variant.key, ...tags }) : merchantLandingUrl(entry.path, tags);
    const gallery = content.gallery.map((g) => g.src).filter((src) => src !== variant.image);
    const mainImage = variant.image ?? gallery[0] ?? product.images[0] ?? siteConfig.ogImage;
    const lines = [
      `<g:id>${esc(variant.sku)}</g:id>`,
      ...(entry.hasColourChoice ? [`<g:item_group_id>${esc(product.sku)}</g:item_group_id>`, `<g:color>${esc(variant.label)}</g:color>`] : []),
      `<g:title>${esc(entry.hasColourChoice ? `${content.merchant.title}, ${variant.label}` : content.merchant.title)}</g:title>`,
      `<g:description>${esc(content.merchant.description)}</g:description>`,
      `<g:link>${esc(landing)}</g:link>`,
      `<g:canonical_link>${esc(absolute(entry.path))}</g:canonical_link>`,
      `<g:image_link>${esc(absolute(mainImage))}</g:image_link>`,
      ...gallery.slice(0, 10).map((src) => `<g:additional_image_link>${esc(absolute(src))}</g:additional_image_link>`),
      `<g:availability>${product.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability>`,
      `<g:price>${money(product.price)}</g:price>`,
      `<g:brand>${esc(siteConfig.name)}</g:brand>`,
      `<g:condition>new</g:condition>`,
      `<g:identifier_exists>no</g:identifier_exists>`,
      `<g:google_product_category>${esc(content.seo.googleCategory)}</g:google_product_category>`,
      `<g:product_type>${esc(content.seo.category)}</g:product_type>`,
      `<g:material>${esc(content.seo.material)}</g:material>`,
      `<g:product_weight>${content.merchant.weightGrams} g</g:product_weight>`,
      ...content.merchant.highlights.map((h) => `<g:product_highlight>${esc(h)}</g:product_highlight>`),
      ...content.seo.facts.map(
        (f) =>
          `<g:product_detail><g:section_name>Specifications</g:section_name><g:attribute_name>${esc(f.name)}</g:attribute_name><g:attribute_value>${esc(f.value)}</g:attribute_value></g:product_detail>`,
      ),
      ...(ships
        ? [
            `<g:shipping><g:country>US</g:country><g:price>${money(product.shippingTax ?? 0)}</g:price><g:min_handling_time>${shipping.processingDays.min}</g:min_handling_time><g:max_handling_time>${shipping.processingDays.max}</g:max_handling_time><g:min_transit_time>${usDays.min}</g:min_transit_time><g:max_transit_time>${usDays.max}</g:max_transit_time></g:shipping>`,
          ]
        : []),
    ];
    return `    <item>\n${lines.map((l) => `      ${l}`).join("\n")}\n    </item>`;
  });
}

/**
 * The whole feed document: the inflator, then any catalog items passed in.
 * No product yet means an empty channel, not an error.
 */
export function merchantFeed(product: FeedProduct | null, extraItems: string[] = []): string {
  const items = [...(product ? [merchantFeedItem(product)] : []), ...extraItems].join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${esc(siteConfig.name)}</title>
    <link>${esc(absolute("/"))}</link>
    <description>${esc(siteConfig.description)}</description>
${items}
  </channel>
</rss>
`;
}
