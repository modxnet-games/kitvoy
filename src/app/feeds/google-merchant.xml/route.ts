import { INFLATOR_SLUG, getCatalogProduct } from "@/config/catalog";
import { productContents } from "@/config/products";
import { getProductBySlug } from "@/lib/data/products";
import { catalogFeedItems, merchantFeed } from "@/lib/seo/merchant-feed";

export const dynamic = "force-dynamic";

/**
 * GET /feeds/google-merchant.xml
 * Product feed for free listings in Google Merchant Center (and Microsoft
 * Merchant Center, which reads the same format). Price and stock are live;
 * the listing copy is in config/seo.ts and the format in lib/seo/merchant-feed.ts.
 */
export async function GET() {
  const product = await getProductBySlug(INFLATOR_SLUG).catch(() => null);
  // Catalog products join the feed once their content file says so (merchant.inFeed)
  const extra: string[] = [];
  for (const content of productContents) {
    const entry = getCatalogProduct(content.slug);
    if (!entry || !content.merchant.inFeed) continue;
    const row = await getProductBySlug(content.slug).catch(() => null);
    if (row) extra.push(...catalogFeedItems(row, entry, content));
  }
  return new Response(merchantFeed(product, extra), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
