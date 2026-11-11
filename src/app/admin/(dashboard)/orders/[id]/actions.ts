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
import { siteConfig } from "@/config/site";
import { isAdminAuthenticated } from "@/lib/auth/admin-session";
import { RECOVERY_LINK_TTL_MS, RESUME_LINK_PARAM, isOpenOrder } from "@/lib/checkout/resume-token";
import { issueCheckoutToken } from "@/lib/checkout/tokens";

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

/**
 * A link that opens an unpaid order's payment step in the customer's browser,
 * details filled in: for emailing to a customer whose checkout failed. The
 * link carries its own token, good for 48 hours; only its hash is stored, so
 * it can't be shown again later.
 */
export async function createCheckoutLinkAction(orderId: string): Promise<{ url: string; expiresAt: string } | { error: string }> {
  if (!(await isAdminAuthenticated())) return { error: "Not signed in" };
  const order = await getOrderById(orderId);
  if (!order) return { error: "Order not found" };
  if (!isOpenOrder(order)) return { error: "This order is already paid or canceled" };

  const token = await issueCheckoutToken(order.id, "link", RECOVERY_LINK_TTL_MS);
  return {
    url: `${siteConfig.url.replace(/\/$/, "")}/checkout?${RESUME_LINK_PARAM}=${token}`,
    expiresAt: new Date(Date.now() + RECOVERY_LINK_TTL_MS).toISOString(),
  };
}
