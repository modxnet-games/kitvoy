import { landingConfig } from "@/config/landing";
import { productSeo } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { getProductBySlug } from "@/lib/data/products";

export const dynamic = "force-dynamic";

const xml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * GET /feeds/google-merchant.xml
 * Product feed for free listings in Google Merchant Center (and Microsoft
 * Merchant Center, which reads the same format). Price and stock are live.
 */
export async function GET() {
  const product = await getProductBySlug(landingConfig.productSlug).catch(() => null);
  const url = (path: string) => new URL(path, siteConfig.url).toString();
  const items = product
    ? `
    <item>
      <g:id>${xml(product.sku)}</g:id>
      <g:title>${xml(productSeo.title)}</g:title>
      <g:description>${xml(productSeo.summary)}</g:description>
      <g:link>${xml(url("/"))}</g:link>
      <g:image_link>${xml(url(product.images[0] ?? siteConfig.ogImage))}</g:image_link>
${product.images.slice(1, 10).map((src) => `      <g:additional_image_link>${xml(url(src))}</g:additional_image_link>`).join("\n")}
      <g:availability>${product.stock > 0 ? "in_stock" : "out_of_stock"}</g:availability>
      <g:price>${product.price.toFixed(2)} ${siteConfig.currency}</g:price>
      <g:brand>${xml(siteConfig.name)}</g:brand>
      <g:condition>new</g:condition>
      <g:identifier_exists>no</g:identifier_exists>
      <g:product_type>${xml(productSeo.category)}</g:product_type>
      <g:shipping>
        <g:country>US</g:country>
        <g:price>${(product.shippingTax ?? 0).toFixed(2)} ${siteConfig.currency}</g:price>
      </g:shipping>
    </item>`
    : "";

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>${xml(siteConfig.name)}</title>
    <link>${xml(url("/"))}</link>
    <description>${xml(siteConfig.description)}</description>${items}
  </channel>
</rss>
`;
  return new Response(body, {
    headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
