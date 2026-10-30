import { prisma } from "@/lib/db";
import type { FulfillmentStatus, OrderStatus } from "@prisma/client";

const ORDER_REFERENCE_PREFIX = "KTV-";

function getOrderDelegate() {
  const d = prisma.order;
  return d && typeof d.findMany === "function" ? d : null;
}

export function formatOrderReference(orderId: string): string {
  return `${ORDER_REFERENCE_PREFIX}${orderId.slice(-8).toUpperCase()}`;
}

export type CustomerOrderListItem = {
  id: string;
  status: OrderStatus;
  paymentStatus: string;
  total: number;
  currency: string;
  locale: string;
  createdAt: Date;
  items: { quantity: number }[];
};

export async function getOrdersByUserId(
  userId: string
): Promise<CustomerOrderListItem[]> {
  const order = getOrderDelegate();
  if (!order) return [];

  try {
    const orders = await order.findMany({
      where: { userId },
      include: { items: { select: { quantity: true } } },
      orderBy: { createdAt: "desc" },
    });
    return orders as CustomerOrderListItem[];
  } catch {
    return [];
  }
}

export type CustomerOrderDetail = {
  id: string;
  customerName: string;
  phone: string;
  location: string;
  status: OrderStatus;
  paymentStatus: string;
  fulfillmentStatus: FulfillmentStatus;
  trackingNumber: string | null;
  shippedAt: Date | null;
  subtotal: number;
  shippingCost: number;
  total: number;
  currency: string;
  locale: string;
  createdAt: Date;
  items: {
    id: string;
    productName: string;
    productSlug: string;
    unitPrice: number;
    quantity: number;
    lineTotal: number;
  }[];
};

/**
 * Returns the order only if it belongs to the given user. Otherwise null.
 */
export async function getOrderByIdForCustomer(
  orderId: string,
  userId: string
): Promise<CustomerOrderDetail | null> {
  const order = getOrderDelegate();
  if (!order) return null;

  try {
    const o = await order.findFirst({
      where: { id: orderId, userId },
      include: { items: true },
    });
    return o as CustomerOrderDetail | null;
  } catch {
    return null;
  }
}
