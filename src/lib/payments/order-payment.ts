import { prisma } from "@/lib/db";

/** Order amounts are stored in dollars; payment providers want cents. */
export function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/** Loads an order that can still be paid, or returns an error code. */
export async function getPayableOrder(orderId: unknown) {
  if (typeof orderId !== "string" || !orderId) {
    return { error: "INVALID_ORDER_ID", status: 400 } as const;
  }
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { error: "ORDER_NOT_FOUND", status: 404 } as const;
  if (order.paymentStatus === "paid") {
    return { error: "ORDER_ALREADY_PAID", status: 409 } as const;
  }
  if (order.status === "CANCELED") {
    return { error: "ORDER_CANCELED", status: 409 } as const;
  }
  return { order } as const;
}

/**
 * Marks an order paid. Returns false when it was already paid (e.g. a
 * duplicate webhook), so callers only trigger fulfillment once.
 */
export async function markOrderPaid(orderId: string, paymentRef: string): Promise<boolean> {
  const { count } = await prisma.order.updateMany({
    where: { id: orderId, paymentStatus: { not: "paid" } },
    data: { paymentStatus: "paid", paymentRef, status: "CONFIRMED" },
  });
  return count > 0;
}
