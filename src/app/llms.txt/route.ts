import { INFLATOR_SLUG, catalog, productPath, shipsTo } from "@/config/catalog";
import { getProductContent } from "@/config/products";
import { COUNTRY_RULES } from "@/lib/us-address";
import { deliveryText, processingText, storePolicies } from "@/config/policies";
import { productSeo } from "@/config/seo";
import { siteConfig } from "@/config/site";
import { getBundleSavings, getLineTotal } from "@/lib/bundles";
import { getProductBySlug } from "@/lib/data/products";
import { getStoreSettings } from "@/lib/data/store-settings";
import { formatPrice } from "@/lib/formatters";

export const dynamic = "force-dynamic";

/**
 * GET /llms.txt
 * A plain summary of the store for AI assistants and answer engines
 * (https://llmstxt.org). Prices and contact come from the live store.
 */
export async function GET() {
  const [product, settings] = await Promise.all([
    getProductBySlug(INFLATOR_SLUG).catch(() => null),
    getStoreSettings().catch(() => null),
  ]);
  const url = (path: string) => new URL(path, siteConfig.url).toString();
  const lines = [`# ${siteConfig.name}`, "", `> ${siteConfig.description}`, ""];

  // Products on the shared page template, each with its live price
  for (const entry of catalog) {
    const content = getProductContent(entry.slug);
    if (!content) continue;
    const row = await getProductBySlug(entry.slug).catch(() => null);
    if (!row) continue;
    lines.push(
      `## ${content.name}`,
      "",
      `- [${content.name}](${url(entry.path)}): ${content.seo.summary}`,
      ...[1, 2, 3].map((q) => {
        const total = getLineTotal(row.price, q, entry.slug);
        const saved = getBundleSavings(row.price, q, entry.slug);
        return `- ${q} ${q === 1 ? entry.unit.one : entry.unit.many}: ${formatPrice(total)}${saved > 0 ? ` (save ${formatPrice(saved)})` : ""}`;
      }),
      `- Colors: ${entry.variants.map((v) => v.label).join(", ")}`,
      `- Ships free to: ${shipsTo(entry.slug).map((code) => COUNTRY_RULES[code].name).join(", ")}`,
      `- Availability: ${row.stock > 0 ? "in stock" : "out of stock"}`,
      ...content.seo.facts.map((f) => `- ${f.name}: ${f.value}`),
      "",
    );
  }

  if (product) {
    lines.push(
      `## ${productSeo.title}`,
      "",
      `- [${productSeo.title}](${url(productPath(INFLATOR_SLUG))}): ${productSeo.summary}`,
      ...[1, 2, 3].map((q) => {
        const total = getLineTotal(product.price, q);
        const saved = getBundleSavings(product.price, q);
        return `- ${q} inflator${q === 1 ? "" : "s"}: ${formatPrice(total)}${saved > 0 ? ` (save ${formatPrice(saved)})` : ""}`;
      }),
      `- Shipping: ${(product.shippingTax ?? 0) === 0 ? "free within the United States" : "shown in the cart"}`,
      `- Availability: ${product.stock > 0 ? "in stock" : "out of stock"}`,
      "",
      "### Specifications",
      "",
      ...productSeo.facts.map((f) => `- ${f.name}: ${f.value}`),
      "",
    );
  }

  const { shipping, returns } = storePolicies;
  lines.push(
    "## Policies",
    "",
    `- [Shipping policy](${url("/shipping")}): free and tracked; processed in ${processingText}; US orders delivered ${deliveryText} after shipping (${shipping.carrier}); other countries as listed on the product page`,
    `- [Returns & refunds](${url("/returns")}): unused items in original packaging within ${returns.windowDays} days of delivery; damaged or defective items replaced or fully refunded`,
    `- [Privacy policy](${url("/privacy")})`,
    `- [Terms of service](${url("/terms")})`,
    "",
    "## Help",
    "",
    `- [Help & information](${url("/support")})`,
    `- Support email: ${settings?.supportEmail || storePolicies.supportEmail}`,
    ...(settings?.legalName ? [`- Operated by: ${settings.legalName}${settings.businessAddress ? `, ${settings.businessAddress}` : ""}`] : []),
    "",
  );

  return new Response(lines.join("\n"), {
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=3600" },
  });
}
