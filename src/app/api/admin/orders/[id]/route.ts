import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import {
  deleteOrder,
  getOrderById,
  serializeOrder,
  setOrderStatus,
  updateOrderDetails,
  type CodStatus,
  type OrderUpdateResult,
} from "@/lib/data/admin-orders";

/*
 * One cash-on-delivery order, for the app (Bearer token) and the dashboard
 * (session cookie, same-origin JSON requests only).
 */

type RouteContext = { params: Promise<{ id: string }> };

const unauthorized = () => NextResponse.json({ error: "Unauthorized" }, { status: 401 });

/** GET /api/admin/orders/:id → the order, or 404 { error } */
export async function GET(request: NextRequest, { params }: RouteContext) {
  if (!(await isAuthorizedAdminRequest(request))) return unauthorized();
  const { id } = await params;

  try {
    const order = await getOrderById(id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json(serializeOrder(order));
  } catch (err) {
    console.error("[admin/orders] read failed:", err);
    return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  }
}

/** The older app's fulfilment buttons, as the statuses they mean today. */
const LEGACY_FULFILLMENT = new Map<string, CodStatus>([
  ["SHIPPED", "SHIPPED"],
  ["DELIVERED", "DELIVERED"],
  ["UNFULFILLED", "CONFIRMED"],
]);

/**
 * PATCH /api/admin/orders/:id
 * { adminNote?, trackingNumber?, customerName?, phone?, city?, address? }
 * → the order, or 400/404 { error }.
 *
 * Corrects an order's details. An empty adminNote or trackingNumber clears it;
 * the phone must be a Moroccan number; a new city or address rewrites the
 * order's one-line location too. The status is changed on
 * PATCH /api/admin/orders/:id/status.
 *
 * For the older app only: { fulfillmentStatus: "SHIPPED" | "DELIVERED" |
 * "UNFULFILLED" } is a status change to SHIPPED, DELIVERED or CONFIRMED. Its
 * answer also carries `customerEmail: null`, which that app reads.
 */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  if (!(await isAuthorizedAdminRequest(request))) return unauthorized();
  const { id } = await params;

  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { adminNote, trackingNumber, customerName, phone, city, address, fulfillmentStatus } = body as Record<string, unknown>;
  const details = { adminNote, trackingNumber, customerName, phone, city, address };
  const hasDetails = Object.values(details).some((value) => value !== undefined);

  const legacyStatus = typeof fulfillmentStatus === "string" ? LEGACY_FULFILLMENT.get(fulfillmentStatus.trim().toUpperCase()) : undefined;
  if (fulfillmentStatus !== undefined && !legacyStatus) {
    return NextResponse.json({ error: "Invalid fulfillment status. Valid: UNFULFILLED, SHIPPED, DELIVERED" }, { status: 400 });
  }
  if (!hasDetails && !legacyStatus) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  try {
    // The details are checked before anything is written, so a refused request changes nothing
    let result: OrderUpdateResult | null = hasDetails ? await updateOrderDetails(id, details) : null;
    if (legacyStatus && (!result || result.ok)) result = await setOrderStatus(id, legacyStatus);
    if (!result) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

    return NextResponse.json({
      ...serializeOrder(result.order),
      ...(result.warning && { warning: result.warning }),
      ...(legacyStatus && { customerEmail: null }),
    });
  } catch (err) {
    console.error("[admin/orders] update failed:", err);
    return NextResponse.json({ error: "Failed to update order" }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/orders/:id → { ok: true }, or 404 { error }.
 * Pieces the order still holds go back in stock. (`success` is the key the
 * older app looks for.)
 */
export async function DELETE(request: NextRequest, { params }: RouteContext) {
  if (!(await isAuthorizedAdminRequest(request))) return unauthorized();
  const { id } = await params;

  try {
    if (!(await deleteOrder(id))) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    return NextResponse.json({ ok: true, success: true });
  } catch (err) {
    console.error("[admin/orders] delete failed:", err);
    return NextResponse.json({ error: "Failed to delete order" }, { status: 500 });
  }
}
