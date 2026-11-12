import type { OrderTotals } from "@/lib/payments/money";
import type { CheckoutDetails } from "@/lib/us-address";
import type { ProductDisplay } from "@/types/product";

export type PlaceOrderResult =
  | {
      ok: true;
      orderId: string;
      orderReference: string;
      totals: OrderTotals;
      /** The checkout's session token, to keep for a reload or a retry */
      resumeToken: string | null;
      /** True when the open order of this checkout was updated instead of a new one being created */
      reused: boolean;
    }
  | { ok: false; errorKey: string };

/**
 * Saves the checkout details as a pending (unpaid) order. The payment step
 * (Stripe / PayPal) runs against the returned orderId and charges the
 * returned total. With the session token of a checkout that is still open,
 * the server updates that order rather than creating a second one.
 */
export async function placeOrder(
  details: CheckoutDetails,
  items: { product: ProductDisplay; quantity: number }[],
  options?: { resumeToken?: string | null },
): Promise<PlaceOrderResult> {
  try {
    const res = await fetch("/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...details,
        items: items.map((i) => ({ product: i.product, quantity: i.quantity, variantKey: i.product.variant?.key })),
        resumeToken: options?.resumeToken ?? undefined,
        tracking: {
          // The page, without its query: a resume link's token must not travel any further
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
      resumeToken: typeof json.resumeToken === "string" ? json.resumeToken : null,
      reused: json.reused === true,
    };
  } catch {
    return { ok: false, errorKey: "order.errorGeneric" };
  }
}
