import { NextResponse } from "next/server";
import { getCustomer } from "@/lib/auth/customer-session";
import { prisma } from "@/lib/db";
import type { OrderStatus } from "@prisma/client";

const CANCEL_WINDOW_MS = 5 * 60 * 60 * 1000; // first 5 hours

function isCancellableStatus(status: OrderStatus) {
  // Keep this conservative: only allow before preparation starts.
  return status === "PENDING" || status === "CONFIRMED";
}

export async function POST(request: Request) {
  try {
    const customer = await getCustomer();
    if (!customer) {
      return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
    }

    const body = (await request.json()) as { orderId?: unknown };
    const orderId = typeof body?.orderId === "string" ? body.orderId : "";
    if (!orderId) {
      return NextResponse.json({ error: "MISSING_ORDER_ID" }, { status: 400 });
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: customer.userId },
      select: { id: true, status: true, createdAt: true },
    });

    if (!order) {
      return NextResponse.json({ error: "ORDER_NOT_FOUND" }, { status: 404 });
    }

    const ageMs = Date.now() - order.createdAt.getTime();
    if (ageMs > CANCEL_WINDOW_MS) {
      return NextResponse.json({ error: "TOO_LATE" }, { status: 409 });
    }

    if (order.status === "CANCELED") {
      return NextResponse.json(
        { error: "ALREADY_CANCELED" },
        { status: 409 },
      );
    }

    if (!isCancellableStatus(order.status)) {
      return NextResponse.json(
        { error: "NOT_ALLOWED" },
        { status: 409 },
      );
    }

    await prisma.order.update({
      where: { id: order.id },
      data: { status: "CANCELED" },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("[orders/cancel] error", err);
    return NextResponse.json(
      { error: "CANCEL_FAILED" },
      { status: 500 },
    );
  }
}

