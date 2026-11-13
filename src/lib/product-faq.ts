import { shipsTo, type CatalogProduct } from "@/config/catalog";
import { processingText, storePolicies } from "@/config/policies";
import type { ProductContent } from "@/config/products";
import { getBundleSavings, getLineTotal } from "@/lib/bundles";
import { formatPrice } from "@/lib/formatters";
import { COUNTRY_RULES } from "@/lib/us-address";

/**
 * A product page's FAQ: the product's own questions (config/products), then
 * the shipping, bundle and guarantee answers, which are built from
 * the catalog and the policy config so they can't drift from what checkout
 * and the policy pages say. The page and its FAQPage markup both read this.
 */
export function productFaqs(content: ProductContent, entry: CatalogProduct, unitPrice?: number | null): { q: string; a: string }[] {
  const { supportEmail, returns } = storePolicies;
  const countries = shipsTo(entry.slug);
  const times = countries
    .map((code) => {
      const days = entry.shipping[code]!.days;
      return `${COUNTRY_RULES[code].name} ${days.min}–${days.max} days`;
    })
    .join("; ");

  const money = (q: number) =>
    unitPrice == null ? null : { total: formatPrice(getLineTotal(unitPrice, q, entry.slug)), saved: formatPrice(getBundleSavings(unitPrice, q, entry.slug)) };
  const two = money(2);
  const three = money(3);
  const { one, many } = entry.unit;

  return [
    ...content.faq,
    {
      q: "How fast is shipping, and is it really free?",
      a: `Yes. Shipping is free and tracked on every order, with no minimum. We process orders in ${processingText} and send them from our partner warehouse. After your order ships, delivery usually takes: ${times}. Your tracking number arrives by email as soon as it's on the way.`,
    },
    {
      q: "How do the bundle savings work?",
      a:
        two && three
          ? `Two ${many} cost ${two.total} together, ${two.saved} less than buying them one at a time. Three cost ${three.total}, which saves ${three.saved}. You choose the color of each ${one}, and you'll see your total and your savings before you add a pack to your cart.`
          : `Two or three ${many} cost less per ${one}. You'll see your total and your savings before you add a pack to your cart.`,
    },
    {
      q: `What is the ${returns.windowDays}-Day Money-Back Guarantee?`,
      a: `Every order is covered by our ${returns.windowDays}-Day Money-Back Guarantee. If it isn't right for you, email ${supportEmail} within ${returns.windowDays} days of delivery and we'll arrange your return and refund. If it arrives damaged or faulty, we replace it or refund you in full. Our returns policy has the details.`,
    },
  ];
}
