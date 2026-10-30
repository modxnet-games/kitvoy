import { prisma } from "@/lib/db";

export type FulfillmentResult =
  | { ok: true; fulfillmentRef: string; alreadyFulfilled?: boolean }
  | { ok: false; error: string };

/**
 * Hands a paid order to Zendrop for fulfillment.
 *
 * Zendrop does not document an API for creating orders from a custom store:
 * its help center only supports orders synced from connected Shopify,
 * ClickFunnels or TikTok Shop stores, or orders placed by hand in the Zendrop
 * dashboard. Until Zendrop publishes an order API, paid orders are flagged for
 * manual fulfillment and the owner's order email carries everything needed to
 * place them. Plug the API call in here once it exists.
 */
export async function sendOrderToZendrop(orderId: string): Promise<FulfillmentResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: { paymentStatus: true, fulfillmentRef: true },
  });
  if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };
  if (order.paymentStatus !== "paid") return { ok: false, error: "ORDER_NOT_PAID" };
  if (order.fulfillmentRef) {
    return { ok: true, fulfillmentRef: order.fulfillmentRef, alreadyFulfilled: true };
  }

  return { ok: false, error: "ZENDROP_ORDER_API_UNAVAILABLE" };
}

/** Saves the Zendrop order id and moves the order into PREPARING. */
export async function recordFulfillment(orderId: string, fulfillmentRef: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { fulfillmentRef, status: "PREPARING" },
  });
}
