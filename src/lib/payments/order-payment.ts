import { prisma } from "@/lib/db";
import { sendPurchaseEvent } from "@/lib/analytics/meta-capi";
import { sendOrderNotification } from "@/lib/email";
import { isCjConfigured } from "@/config/fulfillment";
import { sendOrderToCj } from "@/lib/fulfillment/cj";
import { recordFulfillment, sendOrderToZendrop } from "@/lib/fulfillment/zendrop";
import { deliverOrderConfirmation } from "@/lib/order-confirmation";
import { toCents } from "@/lib/payments/money";
import { notifyAdminDevices } from "@/lib/push/admin-devices";
import { validateStockForCheckout } from "@/lib/stock";

export { toCents };

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
  // Stock is kept per product, so a product's colours are counted together
  const perProduct = new Map<string, { productId: string; productName: string; quantity: number }>();
  for (const item of items) {
    if (!item.productId) continue;
    const current = perProduct.get(item.productId);
    if (current) current.quantity += item.quantity;
    else perProduct.set(item.productId, { productId: item.productId, productName: item.productName, quantity: item.quantity });
  }
  const result = await validateStockForCheckout([...perProduct.values()]);
  return result.valid;
}

/** A payment a provider has taken, as marking the order paid needs it. */
export interface PaidOrderInput {
  orderId: string;
  /** What paid it: the Stripe PaymentIntent id or the PayPal capture id */
  paymentRef: string;
  /** What the provider actually took, in dollars */
  paidTotal: number;
  paymentFee?: number;
  paymentMethod?: "card" | "paypal";
  testPayment?: boolean;
}

/**
 * Which order row a payment may mark paid: the order, while it is still unpaid
 * and still costs what was taken. The total is part of the condition because
 * an unpaid order can be edited at any moment, also while a provider is taking
 * the money for what it cost a second ago: an order that has grown since then
 * must not come out paid. Amounts are stored in dollars, so "the same total"
 * is the same number of cents. Null for an amount that isn't a payment.
 */
export function paidOrderWhere(orderId: string, paidTotal: number) {
  if (!Number.isFinite(paidTotal) || paidTotal <= 0) return null;
  const cents = toCents(paidTotal);
  return {
    id: orderId,
    paymentStatus: { not: "paid" },
    total: { gte: (cents - 0.5) / 100, lt: (cents + 0.5) / 100 },
  };
}

type PaidOrderWhere = NonNullable<ReturnType<typeof paidOrderWhere>>;

/** What marking an order paid writes on it. */
export interface PaidOrderData {
  paymentStatus: "paid";
  paymentRef: string;
  status: "CONFIRMED";
  testPayment: boolean;
  paymentMethod?: "card" | "paypal";
  paymentFee?: number;
}

/** The order tables as marking an order paid uses them, inside one transaction. Replaceable in tests. */
export interface PaidOrderStore {
  /** Writes `data` on the orders matching `where`, in one statement; the number of orders changed */
  markPaid(where: PaidOrderWhere, data: PaidOrderData): Promise<number>;
  items(orderId: string): Promise<{ productId: string | null; quantity: number }[]>;
  takeFromStock(productId: string, quantity: number): Promise<void>;
}

/**
 * The rule of completePaidOrder, apart from the database: one conditional
 * write decides whether this payment pays the order, and only its winner
 * takes the items out of stock.
 */
export async function markOrderPaid(store: PaidOrderStore, input: PaidOrderInput): Promise<boolean> {
  const where = paidOrderWhere(input.orderId, input.paidTotal);
  if (!where) return false;
  const changed = await store.markPaid(where, {
    paymentStatus: "paid",
    paymentRef: input.paymentRef,
    status: "CONFIRMED",
    testPayment: input.testPayment ?? false,
    ...(input.paymentMethod ? { paymentMethod: input.paymentMethod } : {}),
    ...(input.paymentFee !== undefined ? { paymentFee: input.paymentFee } : {}),
  });
  if (changed === 0) return false;

  for (const item of await store.items(input.orderId)) {
    if (!item.productId) continue;
    await store.takeFromStock(item.productId, item.quantity);
  }
  return true;
}

/**
 * Marks an order paid and takes its items out of stock, atomically. Returns
 * false when nothing was marked, so callers only notify and fulfill once:
 * the order was already paid (a duplicate capture or webhook), or it no
 * longer costs `paidTotal` (it was edited while the payment was being taken).
 * The caller tells the two apart by reading the order, and must not let the
 * money of the second case go unnoticed.
 */
export async function completePaidOrder(input: PaidOrderInput): Promise<boolean> {
  return prisma.$transaction((tx) =>
    markOrderPaid(
      {
        markPaid: async (where, data) => (await tx.order.updateMany({ where, data })).count,
        items: (orderId) => tx.orderItem.findMany({ where: { orderId } }),
        takeFromStock: async (productId, quantity) => {
          await tx.product.update({ where: { id: productId }, data: { stock: { decrement: quantity } } });
        },
      },
      input,
    ),
  );
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

  // Meta's server-side Purchase (same event_id as the browser's). Once per order; never throws.
  void sendPurchaseEvent(order.id).catch((err) => console.error(`[meta-capi] ${reference} Purchase error:`, err instanceof Error ? err.message : err));

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
