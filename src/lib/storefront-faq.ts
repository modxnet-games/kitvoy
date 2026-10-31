/**
 * The homepage FAQ. The page and its FAQPage structured data both read this,
 * so the markup always matches what visitors see.
 */
export function storefrontFaqs(freeShipping: boolean) {
  return [
    { q: "How much is shipping?", a: freeShipping ? "US shipping is included for this product. Your cart shows the shipping cost and total for your selection. Delivery estimates have not yet been published; check with support before ordering if you need it by a particular date." : "Shipping is shown in your cart before checkout. For delivery timing, check the shipping information or contact support." },
    { q: "Will it work with my tires?", a: "Check your tire’s valve type and required pressure against the product manual before use. Compatibility and pressure limits need confirmation for your particular tires. Do not use an inflator as a repair for a damaged tire." },
    { q: "What comes with my order?", a: "Choose one, two, or three cordless tire inflators. The product photograph shows the inflator and air hose. A verified packing list for cables and adapters is not yet available; contact support if you need a particular accessory." },
    { q: "How do the bundle savings work?", a: "Two inflators receive 15% off their combined price. Three or more receive 25% off. The price for your chosen quantity and the savings are shown before you add it to your cart." },
    { q: "What is the return policy?", a: "A confirmed return window and eligibility terms have not yet been published. Please check shipping & returns or contact support before you buy." },
  ];
}
