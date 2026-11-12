/**
 * Quantity bundle pricing. Shared by the cart (client) and order creation
 * (server) so the price a customer sees is the price they are charged.
 *
 * Each product has its own tiers (config/catalog.ts). A product bought in
 * several colours is still one bundle: the tier follows the product's total
 * quantity, not each colour's.
 */
import { INFLATOR_SLUG, getCatalogProduct, type BundleTier } from "@/config/catalog";

export type { BundleTier };

/** A product the catalog doesn't know is priced like the inflator, the store's original rule. */
function rulesFor(slug?: string | null): { tiers: BundleTier[]; maxDiscount: number } {
  const product = getCatalogProduct(slug) ?? getCatalogProduct(INFLATOR_SLUG)!;
  return { tiers: product.tiers, maxDiscount: product.maxDiscount };
}

export function getBundleTiers(slug?: string | null): BundleTier[] {
  return rulesFor(slug).tiers;
}

/** The inflator's tiers, for its landing page. */
export const BUNDLE_TIERS: BundleTier[] = getBundleTiers(INFLATOR_SLUG);

function roundCents(value: number): number {
  return Math.round(value * 100) / 100;
}

/** The largest tier the quantity qualifies for. */
function tierFor(tiers: BundleTier[], quantity: number): BundleTier | undefined {
  let match: BundleTier | undefined;
  for (const tier of tiers) {
    if (quantity >= tier.quantity) match = tier;
  }
  return match;
}

/** What `quantity` units of one product cost together, bundle discount included. */
export function getLineTotal(unitPrice: number, quantity: number, slug?: string | null): number {
  const { tiers, maxDiscount } = rulesFor(slug);
  const base = unitPrice * quantity;
  const tier = tierFor(tiers, quantity);
  let off = 0;
  if (tier) {
    // A fixed amount makes a round pack price at exactly the tier's quantity;
    // above it, the tier's percentage (when it has one) takes over
    const fixed = tier.amountOff != null && (quantity === tier.quantity || !tier.discount);
    off = fixed ? tier.amountOff! : base * tier.discount;
  }
  // A cheaper unit price must never push a fixed discount past the product's cap
  return roundCents(base - Math.min(off, base * maxDiscount));
}

export function getBundleSavings(unitPrice: number, quantity: number, slug?: string | null): number {
  return roundCents(unitPrice * quantity - getLineTotal(unitPrice, quantity, slug));
}

export interface PricedLineInput {
  /** Lines with the same product id are one bundle */
  productId: string;
  slug?: string | null;
  unitPrice: number;
  quantity: number;
}

/**
 * Line totals for a cart, in the order given. A product's bundle total is
 * split across its colour lines by quantity, in whole cents, so the lines
 * always add up to exactly what the bundle costs.
 */
export function priceLines(lines: PricedLineInput[]): number[] {
  const groups = new Map<string, number[]>();
  lines.forEach((line, index) => {
    const group = groups.get(line.productId);
    if (group) group.push(index);
    else groups.set(line.productId, [index]);
  });

  const totals = new Array<number>(lines.length).fill(0);
  for (const indexes of groups.values()) {
    const first = lines[indexes[0]];
    const quantity = indexes.reduce((sum, i) => sum + lines[i].quantity, 0);
    if (quantity <= 0) continue;
    const groupCents = Math.round(getLineTotal(first.unitPrice, quantity, first.slug) * 100);
    let leftCents = groupCents;
    indexes.forEach((i, position) => {
      const last = position === indexes.length - 1;
      const cents = last ? leftCents : Math.round((groupCents * lines[i].quantity) / quantity);
      leftCents -= cents;
      totals[i] = cents / 100;
    });
  }
  return totals;
}

/** What each line would cost at the single-unit price, minus what it costs in its bundle. */
export function lineSavings(lines: PricedLineInput[]): number[] {
  const totals = priceLines(lines);
  return lines.map((line, i) => roundCents(line.unitPrice * line.quantity - totals[i]));
}
