import type { CatalogProduct } from "@/config/catalog";
import { storePolicies } from "@/config/policies";
import type { ProductContent } from "@/config/products";
import { getBundleSavings, getLineTotal } from "@/lib/bundles";
import { formatPrice } from "@/lib/formatters";
import { interpolate, type Locale } from "@/lib/i18n";
import { getMessages } from "@/messages";

/**
 * A product page's FAQ: the product's own questions (config/products), then
 * the delivery, payment, exchange and pack answers, which are built from the
 * catalog and the policy config so they can't drift from what the checkout
 * and the policy pages say. The page and its FAQPage markup both read this.
 */
export function productFaqs(content: ProductContent, entry: CatalogProduct, locale: Locale, unitPrice?: number | null): { q: string; a: string }[] {
  const { faq } = getMessages(locale);
  const money = (amount: number) => formatPrice(amount, locale);
  const faqs = [
    ...content.faq,
    { q: faq.deliveryQ, a: interpolate(faq.deliveryA, { min: entry.deliveryHours.min, max: entry.deliveryHours.max }) },
    { q: faq.payQ, a: faq.payA },
    { q: faq.exchangeQ, a: interpolate(faq.exchangeA, { days: storePolicies.exchange.windowDays }) },
  ];
  if (unitPrice != null && getBundleSavings(unitPrice, 2, entry.slug) > 0 && getBundleSavings(unitPrice, 3, entry.slug) > 0) {
    faqs.push({
      q: faq.packsQ,
      a: interpolate(faq.packsA, {
        two: money(getLineTotal(unitPrice, 2, entry.slug)),
        twoFull: money(unitPrice * 2),
        twoSaved: money(getBundleSavings(unitPrice, 2, entry.slug)),
        three: money(getLineTotal(unitPrice, 3, entry.slug)),
        threeSaved: money(getBundleSavings(unitPrice, 3, entry.slug)),
      }),
    });
  }
  return faqs;
}
