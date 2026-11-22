/** Order amounts are stored in dirhams; sums are done in centimes so they stay exact. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** The server's figures for an order. */
export interface OrderTotals {
  subtotal: number;
  shippingCost: number;
  total: number;
  /** What the pack saved against the same pieces bought singly */
  savings: number;
}
