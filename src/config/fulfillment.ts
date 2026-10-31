/**
 * CJdropshipping fulfillment settings.
 *
 * Paid orders are created in CJ automatically when CJ_API_KEY is set. Each
 * store product is mapped to the CJ variant that ships for it; an order with an
 * unmapped product is left for manual fulfillment.
 */
export const cjFulfillment = {
  /**
   * Store product slug → CJ variant (vid from CJ's product query by variant SKU).
   * unitCost is CJ's price per unit in USD, used for profit when an order's own
   * CJ charge isn't recorded.
   */
  variants: {
    "cordless-tire-inflator": {
      vid: "2411080301261619100",
      sku: "CJYD218658003CX",
      name: "Car Portable Wireless Tire Inflator — Wired Wireless Black",
      unitCost: 12.94,
    },
  } as Record<string, { vid: string; sku: string; name: string; unitCost: number }>,

  /** CJ shipping method; must be one CJ offers for the variant (CN → US). */
  logisticName: process.env.CJ_LOGISTIC_NAME?.trim() || "CJPacket Sensitive",
  fromCountryCode: "CN",
};

/**
 * Stand-ins for costs an order hasn't recorded yet. Profit that uses any of
 * them is shown as an estimate.
 */
export const costEstimates = {
  /** CJ's CJPacket Sensitive quote, CN → US, taken 2026-10-31: $15.32 for 1 unit, $28.24 for 2 */
  shipping: { firstUnit: 15.32, additionalUnit: 12.92 },
  /** PayPal's standard US checkout rate */
  paypalFee: { percent: 3.49, fixed: 0.49 },
};

/**
 * CJ sandbox orders are never paid or shipped. They're used whenever PayPal is
 * in sandbox mode, so test payments can't create real supplier orders.
 * CJ_SANDBOX=true|false overrides this.
 */
export function isCjSandbox(): boolean {
  const flag = process.env.CJ_SANDBOX?.trim().toLowerCase();
  if (flag === "true") return true;
  if (flag === "false") return false;
  return process.env.PAYPAL_ENV !== "live";
}

export function isCjConfigured(): boolean {
  return Boolean(process.env.CJ_API_KEY?.trim());
}
