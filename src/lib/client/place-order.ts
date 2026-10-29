import type { CheckoutDetails } from "@/lib/us-address";
import type { ProductDisplay } from "@/types/product";

export type PlaceOrderResult =
  | { ok: true; orderId: string; orderReference: string }
  | { ok: false; errorKey: string };

/**
 * Creates a pending (unpaid) order from checkout details. The payment step
 * (Stripe / PayPal) runs against the returned orderId.
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
        items: items.map((i) => ({ product: i.product, quantity: i.quantity })),
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
    return { ok: true, orderId: json.orderId, orderReference: json.orderReference };
  } catch {
    return { ok: false, errorKey: "order.errorGeneric" };
  }
}
