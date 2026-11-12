/**
 * CJdropshipping fulfillment settings.
 *
 * Paid orders are created in CJ automatically when CJ_API_KEY is set. Each
 * store product (and each colour of it) is mapped to the CJ variant that
 * ships for it in config/catalog.ts; an order with an unmapped product is
 * left for manual fulfillment.
 */
import { catalog, getCatalogProduct, getCatalogVariant, type CountryCode } from "@/config/catalog";

type CjVariant = { vid: string; sku: string; name: string; unitCost: number };

/** The CJ shipping method used when the catalog names none for a product and country. */
const DEFAULT_LOGISTIC = "CJPacket Sensitive";

export const cjFulfillment = {
  /**
   * Store product slug → a CJ variant of it, for profit estimates when an
   * order's own CJ charge isn't recorded. For a product with colours this is
   * its dearest one, so an estimate never flatters the margin.
   */
  variants: Object.fromEntries(
    catalog.map((p) => [p.slug, p.variants.reduce((a, b) => (b.cj.unitCost > a.cj.unitCost ? b : a)).cj]),
  ) as Record<string, CjVariant>,

  /** CJ shipping method for US orders; CJ_LOGISTIC_NAME overrides it for products that name no other */
  logisticName: process.env.CJ_LOGISTIC_NAME?.trim() || DEFAULT_LOGISTIC,
  fromCountryCode: "CN",
};

/** The CJ variant that ships for an order line: its colour's, or the product's only one. */
export function cjVariantFor(slug: string | null | undefined, variantKey: string | null | undefined): CjVariant | undefined {
  return getCatalogVariant(slug, variantKey)?.cj;
}

/**
 * The CJ shipping method for an order: the one the catalog names for these
 * products in this country. Products that disagree (or name none) fall back
 * to the store default, which CJ offers on every route the store uses.
 */
export function cjLogisticFor(slugs: (string | null | undefined)[], country: CountryCode): string {
  const methods = new Set(slugs.map((slug) => getCatalogProduct(slug)?.shipping[country]?.method ?? ""));
  const [only] = methods;
  if (methods.size === 1 && only) {
    // The env override predates the catalog and was set for the US default line
    return country === "US" && only === DEFAULT_LOGISTIC ? cjFulfillment.logisticName : only;
  }
  return cjFulfillment.logisticName;
}

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
