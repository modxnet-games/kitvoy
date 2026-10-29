import { prisma } from "@/lib/db";
import type { ShippingAddress } from "@/lib/us-address";

export type FulfillmentResult =
  | { ok: true; fulfillmentRef: string; alreadyFulfilled?: boolean }
  | { ok: false; error: string };

/**
 * Sends a paid order to Zendrop for fulfillment.
 *
 * PLACEHOLDER: the Zendrop API call below is not implemented yet. Map each
 * order item's product to its Zendrop SKU, POST the order with your
 * ZENDROP_API_KEY, and store the Zendrop order id it returns.
 */
export async function sendOrderToZendrop(orderId: string): Promise<FulfillmentResult> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!order) return { ok: false, error: "ORDER_NOT_FOUND" };
  if (order.paymentStatus !== "paid") return { ok: false, error: "ORDER_NOT_PAID" };
  if (order.fulfillmentRef) {
    return { ok: true, fulfillmentRef: order.fulfillmentRef, alreadyFulfilled: true };
  }

  const apiKey = process.env.ZENDROP_API_KEY?.trim();
  if (!apiKey) return { ok: false, error: "ZENDROP_NOT_CONFIGURED" };

  const address = order.shippingAddress as unknown as ShippingAddress | null;
  if (!address) return { ok: false, error: "MISSING_SHIPPING_ADDRESS" };

  const payload = {
    external_order_id: order.id,
    customer: { name: order.customerName, email: order.email, phone: order.phone },
    shipping_address: address,
    line_items: order.items.map((i) => ({ sku: i.productSlug, quantity: i.quantity })),
  };

  // TODO(zendrop): replace with the real request, e.g.
  //   const res = await fetch(`${ZENDROP_API_URL}/orders`, {
  //     method: "POST",
  //     headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
  //     body: JSON.stringify(payload),
  //   });
  //   const fulfillmentRef = (await res.json()).id;
  console.info("[zendrop] fulfillment not implemented yet; payload:", JSON.stringify(payload));
  return { ok: false, error: "ZENDROP_NOT_IMPLEMENTED" };
}

/** Saves the Zendrop order id and moves the order into PREPARING. */
export async function recordFulfillment(orderId: string, fulfillmentRef: string) {
  await prisma.order.update({
    where: { id: orderId },
    data: { fulfillmentRef, status: "PREPARING" },
  });
}
