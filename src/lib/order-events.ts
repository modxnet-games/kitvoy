import { prisma } from "@/lib/db";
import { sendPurchaseEvent } from "@/lib/analytics/meta-capi";
import { sendOrderNotification } from "@/lib/email";
import { orderReferenceOf } from "@/lib/order-reference";
import { notifyAdminDevices } from "@/lib/push/admin-devices";

/**
 * Everything that follows a new cash-on-delivery order: the owner's phones
 * ring, the owner gets the order by email, and Meta gets the server half of
 * the Purchase event. Each part is best-effort and independent, and none of
 * them can fail the customer's order (the API runs this after it has answered).
 */
export async function afterOrderPlaced(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const reference = orderReferenceOf(order.id);
  const pieces = order.items.reduce((sum, item) => sum + item.quantity, 0);

  const results = await Promise.allSettled([
    notifyAdminDevices({ id: order.id, reference, customerName: order.customerName, city: order.city, total: order.total, itemCount: pieces }),
    sendOrderNotification({
      id: order.id,
      orderReference: reference,
      customerName: order.customerName,
      phone: order.phone,
      location: order.location,
      items: order.items.map((item) => ({ productName: item.productName, productSlug: item.productSlug, quantity: item.quantity, unitPrice: item.unitPrice, lineTotal: item.lineTotal })),
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      total: order.total,
      currency: order.currency,
      locale: order.locale,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
    }),
    sendPurchaseEvent(order.id),
  ]);
  for (const result of results) {
    if (result.status === "rejected") console.error(`[order] ${reference}: a follow-up step failed:`, result.reason);
  }
}
