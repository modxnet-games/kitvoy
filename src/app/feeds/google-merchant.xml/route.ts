import { landingConfig } from "@/config/landing";
import { getProductBySlug } from "@/lib/data/products";
import { merchantFeed } from "@/lib/seo/merchant-feed";

export const dynamic = "force-dynamic";

/**
 * GET /feeds/google-merchant.xml
 * Product feed for free listings in Google Merchant Center (and Microsoft
 * Merchant Center, which reads the same format). Price and stock are live;
 * the listing copy is in config/seo.ts and the format in lib/seo/merchant-feed.ts.
 */
export async function GET() {
  const product = await getProductBySlug(landingConfig.productSlug).catch(() => null);
  return new Response(merchantFeed(product), {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
