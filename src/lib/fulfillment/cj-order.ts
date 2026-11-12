import { cjFulfillment, cjLogisticFor, cjVariantFor } from "@/config/fulfillment";
import { shipsTo } from "@/config/catalog";
import { COUNTRY_RULES, US_STATES, countryOf, type CountryCode, type ShippingAddress } from "@/lib/us-address";

/** CJ's createOrderV2 payType: 2 pays from the CJ balance, 3 only creates the order. */
export type CjPayType = 2 | 3;

export interface CjOrderInput {
  id: string;
  reference: string;
  customerName: string;
  email: string | null;
  phone: string;
  total: number;
  shippingAddress: ShippingAddress | null;
  items: { productSlug: string | null; productName: string; quantity: number; variantKey?: string | null }[];
}

export interface CjOrderPayload {
  orderNumber: string;
  shippingCountryCode: CountryCode;
  shippingCountry: string;
  shippingProvince: string;
  shippingCity: string;
  shippingAddress: string;
  shippingAddress2?: string;
  shippingZip: string;
  shippingCustomerName: string;
  shippingPhone: string;
  email?: string;
  remark: string;
  shopAmount: number;
  logisticName: string;
  fromCountryCode: string;
  payType: CjPayType;
  isSandbox: 0 | 1;
  products: { vid: string; quantity: number }[];
}

const clip = (value: string, max: number) => value.trim().slice(0, max);

/**
 * Builds the CJ createOrderV2 body for a paid order, or explains why the order
 * can't go to CJ automatically. The order id (unique) is the CJ order number,
 * so CJ rejects a second create for the same order.
 */
export function buildCjOrderPayload(
  order: CjOrderInput,
  options: { payType: CjPayType; sandbox: boolean },
): { ok: true; payload: CjOrderPayload } | { ok: false; error: string } {
  const address = order.shippingAddress;
  const country = countryOf(address);
  const rules = COUNTRY_RULES[country];
  const regionNeeded = rules.region !== "optional";
  const zipNeeded = !rules.postalOptional;
  if (!address?.address1 || !address.city || (regionNeeded && !address.state) || (zipNeeded && !address.zip)) {
    return { ok: false, error: "The order has no complete shipping address" };
  }

  const quantities = new Map<string, number>();
  for (const item of order.items) {
    const variant = cjVariantFor(item.productSlug, item.variantKey);
    if (!variant) return { ok: false, error: `“${item.productName}” isn't linked to a CJ variant` };
    if (!shipsTo(item.productSlug).includes(country)) {
      return { ok: false, error: `“${item.productName}” doesn't ship to ${rules.name}` };
    }
    quantities.set(variant.vid, (quantities.get(variant.vid) ?? 0) + item.quantity);
  }
  if (quantities.size === 0) return { ok: false, error: "The order has no items" };

  // CJ wants a province on every order: the state's full name in the US, the
  // region as typed elsewhere, and the city where a country's addresses have none
  const province =
    country === "US" ? (US_STATES.find((s) => s.code === address.state)?.name ?? address.state) : address.state || address.city;
  return {
    ok: true,
    payload: {
      orderNumber: order.id,
      shippingCountryCode: country,
      shippingCountry: rules.name,
      shippingProvince: clip(province, 50),
      shippingCity: clip(address.city, 50),
      shippingAddress: clip(address.address1, 500),
      ...(address.address2?.trim() ? { shippingAddress2: clip(address.address2, 500) } : {}),
      shippingZip: clip(address.zip ?? "", 20),
      shippingCustomerName: clip(order.customerName, 50),
      shippingPhone: clip(order.phone, 20),
      ...(order.email ? { email: clip(order.email, 50) } : {}),
      remark: `Kitvoy order ${order.reference}`,
      shopAmount: order.total,
      logisticName: cjLogisticFor(order.items.map((i) => i.productSlug), country),
      fromCountryCode: cjFulfillment.fromCountryCode,
      payType: options.payType,
      isSandbox: options.sandbox ? 1 : 0,
      products: [...quantities].map(([vid, quantity]) => ({ vid, quantity })),
    },
  };
}

/** CJ statuses meaning the supplier has been paid and will ship. */
export const CJ_PAID_STATUSES = new Set(["UNSHIPPED", "SHIPPED", "DELIVERED"]);
/** CJ statuses meaning the order exists but still has to be paid in CJ. */
export const CJ_UNPAID_STATUSES = new Set(["CREATED", "IN_CART", "UNPAID"]);
