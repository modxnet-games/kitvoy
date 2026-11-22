import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { getDashboardOverview } from "@/lib/data/sales-overview";

/**
 * GET /api/admin/dashboard/overview
 * The figures of the home screen, from cash-on-delivery orders, in the store's
 * time zone.
 * - `cod`: what there is to do (to call, to ship, in delivery), today, this
 *   month, the last 7 days and the newest orders.
 * - `timeZone`, `today`, `week`, `month`: the keys an older version of the app
 *   reads, filled from delivered orders (`month.profit` is all 0).
 */
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getDashboardOverview());
  } catch (err) {
    console.error("[admin/dashboard/overview] failed:", err);
    return NextResponse.json({ error: "Failed to load sales figures" }, { status: 500 });
  }
}
