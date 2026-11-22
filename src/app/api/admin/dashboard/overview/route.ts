import { NextRequest, NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import { getSalesOverview } from "@/lib/data/sales-overview";

/**
 * GET /api/admin/dashboard/overview
 * Sales (delivered orders) for today, this calendar week (Mon–Sun, with the
 * same days of last week for comparison) and this month. Days follow the
 * store's time zone. `month.profit` keeps its keys for the admin app, all 0.
 */
export async function GET(request: NextRequest) {
  if (!getAdminFromRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return NextResponse.json(await getSalesOverview());
  } catch (err) {
    console.error("[admin/dashboard/overview] failed:", err);
    return NextResponse.json({ error: "Failed to load sales figures" }, { status: 500 });
  }
}
