/**
 * CJdropshipping fulfillment settings.
 *
 * Paid orders are created in CJ automatically when CJ_API_KEY is set. Each
 * store product is mapped to the CJ variant that ships for it; an order with an
 * unmapped product is left for manual fulfillment.
 */
export const cjFulfillment = {
  /** Store product slug → CJ variant (vid from CJ's product query by variant SKU). */
  variants: {
    "cordless-tire-inflator": {
      vid: "2411080301261619100",
      sku: "CJYD218658003CX",
      name: "Car Portable Wireless Tire Inflator — Wired Wireless Black",
    },
  } as Record<string, { vid: string; sku: string; name: string }>,

  /** CJ shipping method; must be one CJ offers for the variant (CN → US). */
  logisticName: process.env.CJ_LOGISTIC_NAME?.trim() || "CJPacket Sensitive",
  fromCountryCode: "CN",
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
