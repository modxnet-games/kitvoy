import { prisma } from "@/lib/db";
import { sendOrderNotification } from "@/lib/email";
import { isCjConfigured } from "@/config/fulfillment";
import { sendOrderToCj } from "@/lib/fulfillment/cj";
import { recordFulfillment, sendOrderToZendrop } from "@/lib/fulfillment/zendrop";
import { deliverOrderConfirmation } from "@/lib/order-confirmation";
import { notifyAdminDevices } from "@/lib/push/admin-devices";
import { validateStockForCheckout } from "@/lib/stock";

export { toCents } from "@/lib/payments/money";

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
export async function completePaidOrder(
  orderId: string,
  paymentRef: string,
  paymentFee?: number,
  paymentMethod?: "card" | "paypal",
  testPayment = false,
): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: orderId, paymentStatus: { not: "paid" } },
      data: {
        paymentStatus: "paid",
        paymentRef,
        status: "CONFIRMED",
        testPayment,
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(paymentFee !== undefined ? { paymentFee } : {}),
      },
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
 * Everything that happens once money is in: customer confirmation, owner
 * email, admin push, and the fulfillment hand-off. Each step is best-effort
 * and never throws, because the customer has already paid.
 *
 * `testPayment` (a Stripe test-mode payment) runs everything except the
 * supplier hand-off, so testing checkout on the live site never creates a
 * real CJ order; the admin shows why it wasn't sent.
 */
export async function afterOrderPaid(orderId: string, options: { testPayment?: boolean } = {}): Promise<void> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const reference = orderReference(order.id);

  // Runs alongside the rest so its SMTP retries never hold up the push or CJ
  void deliverOrderConfirmation(order.id).then((r) => {
    if (!r.sent) console.warn(`[orders] ${reference} confirmation email not sent: ${r.reason}`);
  });

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

  await notifyAdminDevices({
    id: order.id,
    reference,
    customerName: order.customerName,
    total: order.total,
    itemCount: order.items.reduce((sum, i) => sum + i.quantity, 0),
  });

  if (options.testPayment) {
    await prisma.order
      .update({ where: { id: order.id }, data: { fulfillmentError: "Stripe test-mode payment: not sent to the supplier. Delete this order when you're done testing." } })
      .catch((err) => console.error("[fulfillment] couldn't flag test order:", err));
    console.info(`[fulfillment] ${reference} is a test payment; not sent to the supplier`);
    return;
  }

  try {
    if (isCjConfigured()) {
      const cj = await sendOrderToCj(order.id);
      if (cj.ok) console.info(`[fulfillment] ${reference} sent to CJ as ${cj.cjOrderId} (${cj.status})`);
      else console.warn(`[fulfillment] ${reference} needs attention: ${cj.error}`);
      return;
    }
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
