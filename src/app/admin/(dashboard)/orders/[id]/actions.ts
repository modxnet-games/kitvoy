"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireAdmin } from "@/lib/auth/admin-session";
import { addressLineOf, deleteOrder, setOrderStatus, updateOrderDetails, type OrderDetailsInput } from "@/lib/data/admin-orders";

/** The pages that show an order, and the product list (a status can move the stock). */
function revalidateOrderPages(orderId?: string) {
  revalidatePath("/admin");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/products");
  if (orderId) revalidatePath(`/admin/orders/${orderId}`);
}

/** Gives an order a status. `warning` is set when the order came back to life and the stock no longer covered it. */
export async function updateOrderStatusAction(orderId: string, status: string): Promise<{ error?: string; warning?: string }> {
  await requireAdmin();
  if (typeof orderId !== "string") return { error: "Order not found" };

  const result = await setOrderStatus(orderId, status);
  if (!result.ok) return { error: result.error };
  revalidateOrderPages(orderId);
  return result.warning ? { warning: result.warning } : {};
}

/** An order's editable details as they are stored, for the forms to show after a save. */
export interface SavedOrderDetails {
  customerName: string;
  phone: string;
  city: string;
  address: string;
  adminNote: string;
  trackingNumber: string;
}

/** Saves the note, the tracking number or the customer's details. */
export async function updateOrderDetailsAction(orderId: string, details: OrderDetailsInput): Promise<{ error?: string; saved?: SavedOrderDetails }> {
  await requireAdmin();
  if (typeof orderId !== "string") return { error: "Order not found" };
  if (!details || typeof details !== "object") return { error: "Nothing to update" };

  // Only the fields an edit may touch are read from what the browser sent
  const { adminNote, trackingNumber, customerName, phone, city, address } = details;
  const result = await updateOrderDetails(orderId, { adminNote, trackingNumber, customerName, phone, city, address });
  if (!result.ok) return { error: result.error };
  revalidateOrderPages(orderId);

  const { order } = result;
  return {
    saved: {
      customerName: order.customerName,
      phone: order.phone,
      city: order.city ?? "",
      address: addressLineOf(order),
      adminNote: order.adminNote ?? "",
      trackingNumber: order.trackingNumber ?? "",
    },
  };
}

export async function deleteOrderAction(orderId: string): Promise<{ error?: string }> {
  await requireAdmin();
  if (typeof orderId !== "string" || !(await deleteOrder(orderId))) return { error: "Order not found" };

  revalidateOrderPages();
  redirect("/admin/orders");
}
