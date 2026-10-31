import { NextRequest, NextResponse } from "next/server";

import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import { getSalesOverview } from "@/lib/data/sales-overview";

/**
 * GET /api/admin/dashboard/overview
 * Paid sales for today, this calendar week (Mon–Sun, with the same days of
 * last week for comparison) and this month, plus the month's profit after
 * supplier, shipping and payment costs. Days follow the store's time zone.
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
