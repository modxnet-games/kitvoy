import { shipsTo, type CatalogProduct } from "@/config/catalog";
import { processingText, storePolicies } from "@/config/policies";
import type { ProductContent } from "@/config/products";
import { getBundleSavings, getLineTotal } from "@/lib/bundles";
import { formatPrice } from "@/lib/formatters";
import { COUNTRY_RULES } from "@/lib/us-address";

/**
 * A product page's FAQ: the product's own questions (config/products), then
 * the shipping, import-tax, bundle and returns answers, which are built from
 * the catalog and the policy config so they can't drift from what checkout
 * and the policy pages say. The page and its FAQPage markup both read this.
 */
export function productFaqs(content: ProductContent, entry: CatalogProduct, unitPrice?: number | null): { q: string; a: string }[] {
  const { supportEmail, returns } = storePolicies;
  const countries = shipsTo(entry.slug);
  const abroad = countries.some((code) => code !== "US");
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
      q: "Where does it ship from, and how long does delivery take?",
      a: `Shipping is free and tracked on every order. Your order is packed and sent by our partner warehouse overseas, not from a local warehouse, so it takes longer than a domestic parcel. We process orders in ${processingText}. After your order ships, delivery usually takes: ${times}. You'll get a tracking number by email as soon as it's on the way.`,
    },
    ...(abroad
      ? [
          {
            q: "Are import taxes included?",
            a: "Our prices include shipping. For orders outside the United States, import VAT or customs duties, where your country charges them on parcels from abroad, are collected on delivery and are not included in the price.",
          },
        ]
      : []),
    {
      q: "How do the bundle savings work?",
      a:
        two && three
          ? `Two ${many} cost ${two.total} together, ${two.saved} less than buying them one at a time. Three cost ${three.total}, which saves ${three.saved}. You choose the colour of each ${one}, and you'll see your total and your savings before you add a pack to your cart.`
          : `Two or three ${many} cost less per ${one}. You'll see your total and your savings before you add a pack to your cart.`,
    },
    {
      q: "What is the return policy?",
      a: `If it isn't right for you, return it unused in its original packaging within ${returns.windowDays} days of delivery for a refund. Return shipping for change-of-mind returns is paid by you. If it arrives damaged or defective, we'll replace it or refund you in full and cover the return shipping. Email ${supportEmail} to start a return.`,
    },
  ];
}
