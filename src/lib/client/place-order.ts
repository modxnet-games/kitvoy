import type { CheckoutDetails } from "@/lib/checkout-details";
import type { Locale } from "@/lib/i18n";
import type { OrderTotals } from "@/lib/money";
import type { ProductDisplay } from "@/types/product";

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderReference: string; totals: OrderTotals }
  | { ok: false; errorKey: string; fields?: Record<string, string> };

/**
 * Places the cash-on-delivery order: sends the delivery details and the cart
 * (ids, quantities, colour and size only: the server prices it) and returns
 * the order reference and the server's totals, or the message key of what
 * went wrong.
 */
export async function placeOrder(
  details: CheckoutDetails,
  locale: Locale,
  items: { product: ProductDisplay; quantity: number }[],
  /** The hidden field no person fills in */
  website: string,
): Promise<PlaceOrderResult> {
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...details,
        locale,
        website,
        items: items.map((i) => ({ productId: i.product.id, quantity: i.quantity, variantKey: i.product.variant?.key })),
        // The page, without its query
        tracking: { eventSourceUrl: `${window.location.origin}${window.location.pathname}` },
      }),
    });
    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.orderReference) {
      return { ok: false, errorKey: typeof json?.error === "string" ? json.error : "order.errorGeneric", fields: json?.fields };
    }
    return { ok: true, orderId: json.orderId, orderReference: json.orderReference, totals: json.totals };
  } catch {
    return { ok: false, errorKey: "order.errorGeneric" };
  }
}

/** What the thank-you page shows about the order just placed; kept for the tab's lifetime only. */
export interface PlacedOrder {
  reference: string;
  name: string;
  phone: string;
  total: number;
}

const PLACED_KEY = "chrilik-placed-order";

export function rememberPlacedOrder(order: PlacedOrder): void {
  try {
    sessionStorage.setItem(PLACED_KEY, JSON.stringify(order));
  } catch {
    // Private mode: the thank-you page still has the reference from its address
  }
}

/** The saved order as it is stored: text, so a component can read it as a store snapshot (equal text, equal value). */
export function readPlacedOrderText(): string | null {
  try {
    return sessionStorage.getItem(PLACED_KEY);
  } catch {
    return null;
  }
}

/** The saved order, if it is the one with this reference. */
export function parsePlacedOrder(text: string | null, reference: string): PlacedOrder | null {
  try {
    const saved = JSON.parse(text ?? "null") as PlacedOrder | null;
    return saved && saved.reference === reference ? saved : null;
  } catch {
    return null;
  }
}
