import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import {
  updateOrderStatus,
  isValidOrderStatus,
  getOrderById,
} from "@/lib/data/admin-orders";
import type { OrderStatus } from "@prisma/client";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await request.json();
    const { status } = body;

    if (!status || !isValidOrderStatus(status)) {
      return NextResponse.json(
        { error: "Invalid status. Valid: PENDING, CONFIRMED, PREPARING, SHIPPED, DELIVERED, CANCELED" },
        { status: 400 },
      );
    }

    const order = await getOrderById(id);
    if (!order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const updated = await updateOrderStatus(id, status as OrderStatus);
    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update order status" },
      { status: 500 },
    );
  }
}
