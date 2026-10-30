import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { getOrderById, deleteOrder, updateOrderFulfillment, formatOrderReference } from "@/lib/data/admin-orders";
import { prisma } from "@/lib/db";
import { sendShippingConfirmation } from "@/lib/email";
import { trackingUrl } from "@/lib/tracking";
import type { ShippingAddress } from "@/lib/us-address";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    return NextResponse.json(order);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch order" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }
    await deleteOrder(id);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/admin/orders/:id  { fulfillmentStatus?, trackingNumber? }
 * Manual fulfillment: record the tracking number and move a paid order through
 * UNFULFILLED → SHIPPED → DELIVERED. Accepts the mobile app's Bearer token or
 * the web dashboard's session cookie (same-origin JSON requests only).
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const { fulfillmentStatus, trackingNumber } = body as Record<string, unknown>;
    if (fulfillmentStatus === undefined && trackingNumber === undefined) {
      return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    }

    const result = await updateOrderFulfillment(id, { fulfillmentStatus, trackingNumber });
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    const { fulfillmentStatus: status, trackingNumber: tracking, shippedAt, status: orderStatus } = result.order;
    const customerEmail = await emailCustomerIfShipped(result.order.id, result.previous);
    return NextResponse.json({ fulfillmentStatus: status, trackingNumber: tracking, shippedAt, status: orderStatus, customerEmail });
  } catch (err) {
    console.error("[admin/orders] fulfillment update failed:", err);
    return NextResponse.json({ error: "Failed to update fulfillment" }, { status: 500 });
  }
}

type CustomerEmailResult = { sent: boolean; reason?: string } | null;

/**
 * Emails the customer when an order becomes Shipped, or when its tracking
 * number changes while shipped. Returns null when no email was due.
 */
async function emailCustomerIfShipped(
  orderId: string,
  previous: { fulfillmentStatus: string; trackingNumber: string | null },
): Promise<CustomerEmailResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.fulfillmentStatus !== "SHIPPED" || !order.trackingNumber) return null;

  const justShipped = previous.fulfillmentStatus === "UNFULFILLED";
  const trackingChanged = previous.fulfillmentStatus === "SHIPPED" && previous.trackingNumber !== order.trackingNumber;
  if (!justShipped && !trackingChanged) return null;
  if (!order.email) return { sent: false, reason: "This order has no customer email" };

  const address = order.shippingAddress as unknown as ShippingAddress | null;
  const shipTo = address
    ? [
        order.customerName,
        [address.address1, address.address2].filter(Boolean).join(", "),
        `${address.city}, ${address.state} ${address.zip}`,
      ]
    : [order.customerName, order.location];

  const result = await sendShippingConfirmation({
    to: order.email,
    customerName: order.customerName,
    orderReference: formatOrderReference(order.id),
    trackingNumber: order.trackingNumber,
    trackingUrl: trackingUrl(order.trackingNumber),
    shipTo,
    items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity })),
    isUpdate: trackingChanged,
  });
  return result.sent ? { sent: true } : { sent: false, reason: result.reason };
}
