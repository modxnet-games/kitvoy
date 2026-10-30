/**
 * Quantity bundle pricing. Shared by the cart (client) and order creation
 * (server) so the price a customer sees is the price they are charged.
 */
export interface BundleTier {
  quantity: number;
  /** Fraction off the line total, e.g. 0.15 = 15% off */
  discount: number;
  label: string;
  badge?: string;
}

export const BUNDLE_TIERS: BundleTier[] = [
  { quantity: 1, discount: 0, label: "Buy 1" },
  { quantity: 2, discount: 0.15, label: "Buy 2" },
  { quantity: 3, discount: 0.25, label: "Buy 3" },
];

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Discount for the largest tier the quantity qualifies for. */
export function getBundleDiscount(quantity: number): number {
  let discount = 0;
  for (const tier of BUNDLE_TIERS) {
    if (quantity >= tier.quantity) discount = tier.discount;
  }
  return discount;
}

export function getLineTotal(unitPrice: number, quantity: number): number {
  return roundCents(unitPrice * quantity * (1 - getBundleDiscount(quantity)));
}

export function getBundleSavings(unitPrice: number, quantity: number): number {
  return roundCents(unitPrice * quantity - getLineTotal(unitPrice, quantity));
}
