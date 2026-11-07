/** Order amounts are stored in dollars; payment providers want cents. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** The server's figures for an order, shown on the payment step. */
export interface OrderTotals {
  subtotal: number;
  shippingCost: number;
  total: number;
}
