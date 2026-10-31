import { deliveryText, processingText, storePolicies } from "@/config/policies";

/**
 * The homepage FAQ. The page and its FAQPage structured data both read this,
 * so the markup always matches what visitors see. Shipping and return terms
 * come from the policy config.
 */
export function storefrontFaqs(freeShipping: boolean) {
  const { supportEmail, returns } = storePolicies;
  return [
    { q: "How much is shipping?", a: freeShipping ? `Shipping is free on every order to ${storePolicies.shipping.destinations}. Orders are processed in ${processingText} and usually arrive ${deliveryText} after they ship, with tracking.` : `Shipping is shown in your cart before checkout. Orders are processed in ${processingText} and usually arrive ${deliveryText} after they ship.` },
    { q: "Will it work with my tires?", a: "Check your tire’s valve type and required pressure against the product manual before use. Compatibility and pressure limits need confirmation for your particular tires. Do not use an inflator as a repair for a damaged tire." },
    { q: "What comes with my order?", a: `Choose one, two, or three cordless tire inflators. Each one comes with a USB charging cable. If you need a particular accessory or adapter, email ${supportEmail} before you order.` },
    { q: "How do the bundle savings work?", a: "Two inflators receive 15% off their combined price. Three or more receive 25% off. The price for your chosen quantity and the savings are shown before you add it to your cart." },
    { q: "What is the return policy?", a: `You can return unused items in their original packaging within ${returns.windowDays} days of delivery for a refund. If your inflator arrives damaged or defective, we’ll replace it or refund you in full. Email ${supportEmail} to start a return.` },
  ];
}
