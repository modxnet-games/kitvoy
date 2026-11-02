import { deliveryText, processingText, storePolicies } from "@/config/policies";
import { getBundleSavings, getLineTotal } from "@/lib/bundles";
import { formatPrice } from "@/lib/formatters";

/**
 * The homepage FAQ. The page and its FAQPage structured data both read this,
 * so the markup always matches what visitors see. Shipping and return terms
 * come from the policy config; product facts stay within config/seo.ts.
 */
export function storefrontFaqs(freeShipping: boolean, unitPrice?: number | null) {
  const { supportEmail, returns } = storePolicies;
  const money = (q: number) => (unitPrice == null ? null : { total: formatPrice(getLineTotal(unitPrice, q)), saved: formatPrice(getBundleSavings(unitPrice, q)) });
  const two = money(2);
  const three = money(3);
  return [
    { q: "Will it work with my tires?", a: `It's made for car and motorcycle tires. Before you start, check that your tire valve fits the air hose, and look up your recommended pressure on the sticker inside the driver's door or in your owner's manual. Planning to inflate bike tires or sports balls? Email ${supportEmail} first and we'll help you check the fit. An inflator adds air to a low tire. It can't repair a punctured or damaged one.` },
    { q: "Why buy from Kitvoy?", a: `We sell one product: this cordless tire inflator. ${freeShipping ? `Shipping is free and tracked to ${storePolicies.shipping.destinations}.` : "Every order ships with tracking."} You have ${returns.windowDays} days to return it unused in its original packaging, and if it arrives damaged or defective, we replace it or refund you, return shipping included. Questions go to ${supportEmail}.` },
    { q: "What comes with my order?", a: `Each inflator comes with its air hose and a USB charging cable. You can order one, two or three inflators. If you need a particular adapter, email ${supportEmail} before you order.` },
    { q: "How long does shipping take?", a: freeShipping ? `Shipping is free to ${storePolicies.shipping.destinations}. We process orders in ${processingText}, and delivery usually takes ${deliveryText} after your order ships. You'll get a tracking number by email as soon as it's on the way.` : `Shipping is shown in your cart before checkout. We process orders in ${processingText}, and delivery usually takes ${deliveryText} after your order ships.` },
    { q: "How do the bundle savings work?", a: two && three
      ? `Two inflators cost ${two.total} together, ${two.saved} less than buying them one at a time. Three cost ${three.total}, which saves ${three.saved}, and any order of three or more gets 25% off every inflator. You'll see your total and your savings before you add a bundle to your cart.`
      : "Two or more inflators cost less per inflator, and any order of three or more gets 25% off every inflator. You'll see your total and your savings before you add a bundle to your cart." },
    { q: "What is the return policy?", a: `If it isn't right for you, return it unused in its original packaging within ${returns.windowDays} days of delivery for a refund. Return shipping for change-of-mind returns is paid by you. If your inflator arrives damaged or defective, we'll replace it or refund you in full and cover the return shipping. Email ${supportEmail} to start a return.` },
  ];
}
