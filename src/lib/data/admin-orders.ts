import { prisma } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";

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
