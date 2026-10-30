import { formatOrderReference } from "@/lib/data/admin-orders";
import { prisma } from "@/lib/db";
import { sendShippingConfirmation } from "@/lib/email";
import { trackingUrl } from "@/lib/tracking";
import type { ShippingAddress } from "@/lib/us-address";

export type CustomerEmailResult = { sent: boolean; reason?: string } | null;

/**
 * Emails the customer when an order becomes Shipped, or when its tracking
 * number changes while shipped. Returns null when no email was due.
 */
export async function emailCustomerIfShipped(
  orderId: string,
  previous: { fulfillmentStatus: string; trackingNumber: string | null },
): Promise<CustomerEmailResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.fulfillmentStatus !== "SHIPPED" || !order.trackingNumber) return null;

  const justShipped = previous.fulfillmentStatus === "UNFULFILLED";
  const trackingChanged = previous.fulfillmentStatus === "SHIPPED" && previous.trackingNumber !== order.trackingNumber;
  if (!justShipped && !trackingChanged) return null;
  if (!order.email) return { sent: false, reason: "This order has no customer email" };

  const address = order.shippingAddress as unknown as ShippingAddress | null;
  const shipTo = address
    ? [
        order.customerName,
        [address.address1, address.address2].filter(Boolean).join(", "),
        `${address.city}, ${address.state} ${address.zip}`,
      ]
    : [order.customerName, order.location];

  const result = await sendShippingConfirmation({
    to: order.email,
    customerName: order.customerName,
    orderReference: formatOrderReference(order.id),
    trackingNumber: order.trackingNumber,
    trackingUrl: trackingUrl(order.trackingNumber),
    shipTo,
    items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
    isUpdate: trackingChanged,
  });
  return result.sent ? { sent: true } : { sent: false, reason: result.reason };
}
