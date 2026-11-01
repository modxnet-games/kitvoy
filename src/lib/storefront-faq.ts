import { deliveryText, processingText, storePolicies } from "@/config/policies";

/**
 * The homepage FAQ. The page and its FAQPage structured data both read this,
 * so the markup always matches what visitors see. Shipping and return terms
 * come from the policy config; product facts stay within config/seo.ts.
 */
export function storefrontFaqs(freeShipping: boolean) {
  const { supportEmail, returns } = storePolicies;
  return [
    { q: "Will it work with my tires?", a: `It's made for car and motorcycle tires. Before you start, check that your tire valve fits the air hose, and look up your recommended pressure on the sticker inside the driver's door or in your owner's manual. Planning to inflate bike tires or sports balls? Email ${supportEmail} first and we'll help you check the fit. An inflator adds air to a low tire. It can't repair a punctured or damaged one.` },
    { q: "What comes with my order?", a: `Each inflator comes with its air hose and a USB charging cable. You can order one, two or three inflators. If you need a particular adapter, email ${supportEmail} before you order.` },
    { q: "How long does shipping take?", a: freeShipping ? `Shipping is free to ${storePolicies.shipping.destinations}. We process orders in ${processingText}, and delivery usually takes ${deliveryText} after your order ships. You'll get a tracking number by email as soon as it's on the way.` : `Shipping is shown in your cart before checkout. We process orders in ${processingText}, and delivery usually takes ${deliveryText} after your order ships.` },
    { q: "How do the bundle savings work?", a: "Buy two inflators and save 15% on the pair. Buy three or more and save 25% on all of them. You'll see your total and your savings before you add a bundle to your cart." },
    { q: "What is the return policy?", a: `If it isn't right for you, return it unused in its original packaging within ${returns.windowDays} days of delivery for a refund. Return shipping for change-of-mind returns is paid by you. If your inflator arrives damaged or defective, we'll replace it or refund you in full and cover the return shipping. Email ${supportEmail} to start a return.` },
  ];
}
