import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { getOrderStats } from "@/lib/data/admin-orders";

/**
 * GET /api/admin/dashboard/stats → { total, pending, delivered, canceled, recent, revenue }
 * Counts of cash-on-delivery orders (`recent`: placed in the last 7 days) and
 * the cash collected on delivered ones. An older version of the app reads
 * these keys; the fuller figures are on /api/admin/dashboard/overview.
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await getOrderStats());
  } catch (err) {
    console.error("[admin/dashboard/stats] failed:", err);
    return NextResponse.json({ error: "Failed to fetch stats" }, { status: 500 });
  }
}
