/**
 * Quantity bundle pricing. Shared by the cart (client) and order creation
 * (server) so the price a customer sees is the price they are charged.
 */
export interface BundleTier {
  quantity: number;
  /** Fraction off the line total, e.g. 0.25 = 25% off */
  discount: number;
  /** Fixed dollars off the line total, used instead of `discount` */
  amountOff?: number;
  label: string;
  badge?: string;
}

/**
 * Two inflators are a fixed $19.99 off, so at $59.99 each the pair is $99.99.
 * Three or more are 25% off every inflator.
 */
export const BUNDLE_TIERS: BundleTier[] = [
  { quantity: 1, discount: 0, label: "Buy 1" },
  { quantity: 2, discount: 0, amountOff: 19.99, label: "Buy 2" },
  { quantity: 3, discount: 0.25, label: "Buy 3" },
];

/** A cheaper unit price must never push the fixed 2-pack discount past the 3-pack's 25%. */
const MAX_DISCOUNT = 0.25;

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The largest tier the quantity qualifies for. */
function tierFor(quantity: number): BundleTier | undefined {
  let match: BundleTier | undefined;
  for (const tier of BUNDLE_TIERS) {
    if (quantity >= tier.quantity) match = tier;
  }
  return match;
}

export function getLineTotal(unitPrice: number, quantity: number): number {
  const base = unitPrice * quantity;
  const tier = tierFor(quantity);
  const off = tier ? (tier.amountOff ?? base * tier.discount) : 0;
  return roundCents(base - Math.min(off, base * MAX_DISCOUNT));
}

export function getBundleSavings(unitPrice: number, quantity: number): number {
  return roundCents(unitPrice * quantity - getLineTotal(unitPrice, quantity));
}
