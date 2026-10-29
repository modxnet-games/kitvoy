"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  updateOrderStatus,
  isValidOrderStatus,
  getOrderById,
  deleteOrder,
} from "@/lib/data/admin-orders";
import type { OrderStatus } from "@prisma/client";

export async function updateOrderStatusAction(
  orderId: string,
  status: string
): Promise<{ error?: string }> {
  if (!isValidOrderStatus(status)) {
    return { error: "Invalid status" };
  }

  const order = await getOrderById(orderId);
  if (!order) {
    return { error: "Order not found" };
  }

  await updateOrderStatus(orderId, status as OrderStatus);
  revalidatePath("/admin/orders");
  revalidatePath(`/admin/orders/${orderId}`);
  revalidatePath("/admin");

  return {};
}

export async function deleteOrderAction(orderId: string): Promise<{ error?: string }> {
  const order = await getOrderById(orderId);
  if (!order) {
    return { error: "Order not found" };
  }

  await deleteOrder(orderId);
  revalidatePath("/admin/orders");
  revalidatePath("/admin");
  redirect("/admin/orders");
  return {};
}
