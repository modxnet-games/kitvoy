import { NextRequest, NextResponse } from "next/server";

import { isCjConfigured } from "@/config/fulfillment";
import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { sendOrderToCj, syncCjOrder } from "@/lib/fulfillment/cj";

/**
 * POST /api/admin/orders/:id/cj  { action: "send" | "sync" }
 * send: create (or finish paying) the order in CJdropshipping.
 * sync: pull its CJ status and tracking number now.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isCjConfigured()) {
    return NextResponse.json({ error: "CJ_API_KEY isn't set on the server" }, { status: 503 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const action = body?.action;

  if (action === "send") {
    const result = await sendOrderToCj(id);
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  }
  if (action === "sync") {
    const result = await syncCjOrder(id);
    return NextResponse.json(result, { status: result.error ? 422 : 200 });
  }
  return NextResponse.json({ error: 'action must be "send" or "sync"' }, { status: 400 });
}
