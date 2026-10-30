import { prisma } from "@/lib/db";
import { sendOrderNotification } from "@/lib/email";
import { recordFulfillment, sendOrderToZendrop } from "@/lib/fulfillment/zendrop";
import { notifyAdminDevices } from "@/lib/orders";
import { validateStockForCheckout } from "@/lib/stock";

/** Order amounts are stored in dollars; payment providers want cents. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

const orderReference = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;

/** Loads an order that can still be paid, or returns an error code. */
export async function getPayableOrder(orderId: unknown) {
  if (typeof orderId !== "string" || !orderId) {
    return { error: "INVALID_ORDER_ID", status: 400 } as const;
  }
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { error: "ORDER_NOT_FOUND", status: 404 } as const;
  if (order.paymentStatus === "paid") {
    return { error: "ORDER_ALREADY_PAID", status: 409 } as const;
  }
  if (order.status === "CANCELED") {
    return { error: "ORDER_CANCELED", status: 409 } as const;
  }
  return { order } as const;
}

/** Checks the order's items are still in stock before taking money. */
export async function orderHasStock(orderId: string): Promise<boolean> {
  const items = await prisma.orderItem.findMany({ where: { orderId } });
  const result = await validateStockForCheckout(
    items
      .filter((i) => i.productId)
      .map((i) => ({ productId: i.productId!, productName: i.productName, quantity: i.quantity })),
  );
  return result.valid;
}

/**
 * Marks an order paid and takes its items out of stock, atomically. Returns
 * false when it was already paid (duplicate capture or webhook), so callers
 * only notify and fulfill once.
 */
export async function completePaidOrder(orderId: string, paymentRef: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: { not: "paid" } },
      data: { paymentStatus: "paid", paymentRef, status: "CONFIRMED" },
    });
    if (count === 0) return false;

    const items = await tx.orderItem.findMany({ where: { orderId } });
    for (const item of items) {
      if (!item.productId) continue;
      await tx.product.update({
        where: { id: item.productId },
        data: { stock: { decrement: item.quantity } },
      });
    }
    return true;
  });
}

/**
 * Everything that happens once money is in: owner email, admin push, and the
 * fulfillment hand-off. Each step is best-effort and never throws, because the
 * customer has already paid.
 */
export async function afterOrderPaid(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const reference = orderReference(order.id);

  try {
    const email = await sendOrderNotification({
      id: order.id,
      orderReference: reference,
      customerName: order.customerName,
      phone: order.phone,
      location: order.location,
      items: order.items.map((i) => ({
        productName: i.productName,
        productSlug: i.productSlug,
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        lineTotal: i.lineTotal,
      })),
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      total: order.total,
      currency: order.currency,
      locale: order.locale,
      paymentMethod: order.paymentMethod,
      createdAt: order.createdAt,
    });
    if (!email.sent) console.warn("[orders] Order notification not sent:", email.reason);
  } catch (err) {
    console.error("[orders] Order notification error:", err);
  }

  await notifyAdminDevices({ id: order.id, reference, customerName: order.customerName, total: order.total });

  try {
    const fulfillment = await sendOrderToZendrop(order.id);
    if (fulfillment.ok && !fulfillment.alreadyFulfilled) {
      await recordFulfillment(order.id, fulfillment.fulfillmentRef);
    } else if (!fulfillment.ok) {
      console.warn(`[fulfillment] ${reference} needs manual fulfillment: ${fulfillment.error}`);
    }
  } catch (err) {
    console.error("[fulfillment] error:", err);
  }
}
