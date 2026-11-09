import { landingConfig } from "@/config/landing";
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
    getProductBySlug(landingConfig.productSlug).catch(() => null),
    getStoreSettings().catch(() => null),
  ]);
  const url = (path: string) => new URL(path, siteConfig.url).toString();
  const lines = [`# ${siteConfig.name}`, "", `> ${siteConfig.description}`, ""];

  if (product) {
    lines.push(
      "## Product",
      "",
      `- [${productSeo.title}](${url("/")}): ${productSeo.summary}`,
      ...[1, 2, 3].map((q) => {
        const total = getLineTotal(product.price, q);
        const saved = getBundleSavings(product.price, q);
        return `- ${q} inflator${q === 1 ? "" : "s"}: ${formatPrice(total)}${saved > 0 ? ` (save ${formatPrice(saved)})` : ""}`;
      }),
      `- Shipping: ${(product.shippingTax ?? 0) === 0 ? "free within the United States" : "shown in the cart"}`,
      `- Availability: ${product.stock > 0 ? "in stock" : "out of stock"}`,
      "",
      "## Specifications",
      "",
      ...productSeo.facts.map((f) => `- ${f.name}: ${f.value}`),
      "",
    );
  }

  const { shipping, returns } = storePolicies;
  lines.push(
    "## Policies",
    "",
    `- [Shipping policy](${url("/shipping")}): free to ${shipping.destinations}; processed in ${processingText}; delivered ${deliveryText} after shipping (${shipping.carrier}, tracked)`,
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
