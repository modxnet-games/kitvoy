import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { getOrderById, deleteOrder, updateOrderFulfillment } from "@/lib/data/admin-orders";

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
    return NextResponse.json({ fulfillmentStatus: status, trackingNumber: tracking, shippedAt, status: orderStatus });
  } catch (err) {
    console.error("[admin/orders] fulfillment update failed:", err);
    return NextResponse.json({ error: "Failed to update fulfillment" }, { status: 500 });
  }
}
