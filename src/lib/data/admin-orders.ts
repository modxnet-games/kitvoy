import { prisma } from "@/lib/db";
import type { FulfillmentStatus, OrderStatus } from "@prisma/client";

const ORDER_REFERENCE_PREFIX = "KTV-";

/** Returns the Order delegate when available; null when prisma.order is missing (e.g. client out of sync). */
function getOrderDelegate() {
  const d = prisma.order;
  return d && typeof d.findMany === "function" ? d : null;
}

export function formatOrderReference(orderId: string): string {
  return `${ORDER_REFERENCE_PREFIX}${orderId.slice(-8).toUpperCase()}`;
}

export async function getAllOrders() {
  const order = getOrderDelegate();
  if (!order) return [];
  try {
    return order.findMany({
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}

export async function getOrderById(id: string) {
  const order = getOrderDelegate();
  if (!order) return null;
  try {
    return order.findUnique({
      where: { id },
      include: { items: true },
    });
  } catch {
    return null;
  }
}

export async function updateOrderStatus(id: string, status: OrderStatus) {
  const order = getOrderDelegate();
  if (!order) throw new Error("Order data layer unavailable");
  return order.update({
    where: { id },
    data: { status },
  });
}

/** Delete an order and its items (OrderItems are deleted by cascade). */
export async function deleteOrder(id: string): Promise<void> {
  await prisma.order.delete({
    where: { id },
  });
}

const VALID_STATUSES: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
];

export function isValidOrderStatus(value: string): value is OrderStatus {
  return VALID_STATUSES.includes(value as OrderStatus);
}

/* ------------------------------------------------------------------ */
/*  Manual fulfillment                                                 */
/* ------------------------------------------------------------------ */

const FULFILLMENT_STATUSES: FulfillmentStatus[] = ["UNFULFILLED", "SHIPPED", "DELIVERED"];

export function isValidFulfillmentStatus(value: unknown): value is FulfillmentStatus {
  return typeof value === "string" && FULFILLMENT_STATUSES.includes(value as FulfillmentStatus);
}

/** Carrier tracking numbers: letters, digits, spaces and dashes. */
const TRACKING_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{2,63}$/;

/** Order status that matches a fulfillment step (undoing a shipment goes back to CONFIRMED). */
function orderStatusFor(fulfillment: FulfillmentStatus, current: OrderStatus): OrderStatus {
  if (fulfillment === "SHIPPED") return "SHIPPED";
  if (fulfillment === "DELIVERED") return "DELIVERED";
  return current === "SHIPPED" || current === "DELIVERED" ? "CONFIRMED" : current;
}

export type FulfillmentUpdateResult =
  | { ok: true; order: Awaited<ReturnType<typeof prisma.order.update>> }
  | { ok: false; error: string; status: number };

/**
 * Updates fulfillment for a paid order and keeps the order status in step,
 * so the customer's "My orders" page shows the same thing:
 * UNFULFILLED → (status unchanged), SHIPPED → SHIPPED, DELIVERED → DELIVERED.
 */
export async function updateOrderFulfillment(
  id: string,
  input: { fulfillmentStatus?: unknown; trackingNumber?: unknown },
): Promise<FulfillmentUpdateResult> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) return { ok: false, error: "Order not found", status: 404 };
  if (order.paymentStatus !== "paid") {
    return { ok: false, error: "Only paid orders can be fulfilled", status: 409 };
  }
  if (order.status === "CANCELED") {
    return { ok: false, error: "This order is canceled", status: 409 };
  }

  const next = input.fulfillmentStatus ?? order.fulfillmentStatus;
  if (!isValidFulfillmentStatus(next)) {
    return { ok: false, error: "Invalid fulfillment status. Valid: UNFULFILLED, SHIPPED, DELIVERED", status: 400 };
  }

  let trackingNumber = order.trackingNumber;
  if (input.trackingNumber !== undefined) {
    const raw = typeof input.trackingNumber === "string" ? input.trackingNumber.trim().replace(/\s+/g, " ") : "";
    if (raw && !TRACKING_RE.test(raw)) {
      return { ok: false, error: "Tracking number should be 3–64 letters, digits, spaces or dashes", status: 400 };
    }
    trackingNumber = raw || null;
  }

  if (next !== "UNFULFILLED" && !trackingNumber) {
    return { ok: false, error: "Add a tracking number before marking the order shipped", status: 400 };
  }
  if (next === "DELIVERED" && order.fulfillmentStatus === "UNFULFILLED") {
    return { ok: false, error: "Mark the order shipped before delivered", status: 409 };
  }

  const status = orderStatusFor(next, order.status);

  const updated = await prisma.order.update({
    where: { id },
    data: {
      fulfillmentStatus: next,
      trackingNumber,
      status,
      shippedAt: next === "UNFULFILLED" ? null : (order.shippedAt ?? new Date()),
    },
  });
  return { ok: true, order: updated };
}

const DEFAULT_STATS = {
  total: 0,
  pending: 0,
  delivered: 0,
  canceled: 0,
  recent: 0,
};

export async function getOrderStats() {
  const order = getOrderDelegate();
  if (!order) return { ...DEFAULT_STATS };

  try {
    const [total, pending, delivered, canceled, recent] = await Promise.all([
      order.count(),
      order.count({ where: { status: "PENDING" } }),
      order.count({ where: { status: "DELIVERED" } }),
      order.count({ where: { status: "CANCELED" } }),
      order.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);
    return { total, pending, delivered, canceled, recent };
  } catch {
    return { ...DEFAULT_STATS };
  }
}
