import type { OrderTotals } from "@/lib/payments/money";
import type { CheckoutDetails } from "@/lib/us-address";
import type { ProductDisplay } from "@/types/product";

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderReference: string;
      totals: OrderTotals;
    }
  | { ok: false; errorKey: string };

/**
 * Saves the checkout details as a pending (unpaid) order and returns its
 * reference and the server's totals. Every successful call creates one order.
 */
export async function placeOrder(
  details: CheckoutDetails,
  items: { product: ProductDisplay; quantity: number }[],
): Promise<PlaceOrderResult> {
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...details,
        items: items.map((i) => ({ product: i.product, quantity: i.quantity, variantKey: i.product.variant?.key })),
        tracking: {
          // The page, without its query
          eventSourceUrl: typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname}` : undefined,
        },
      }),
    });
    const json = await res.json();

    if (!res.ok) {
      const errorKey =
        json?.error === "EMPTY_CART"
          ? "order.errorEmptyCart"
          : typeof json?.error === "string"
            ? json.error
            : "order.errorGeneric";
      return { ok: false, errorKey };
    }
    return {
      ok: true,
      orderId: json.orderId,
      orderReference: json.orderReference,
      totals: json.totals,
    };
  } catch {
    return { ok: false, errorKey: "order.errorGeneric" };
  }
}
