import { NextRequest, NextResponse } from "next/server";

import { isCjConfigured } from "@/config/fulfillment";
import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { syncCjTracking } from "@/lib/fulfillment/cj";

/** POST /api/admin/fulfillment/cj-sync — checks every open CJ order for tracking now. */
export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!isCjConfigured()) {
    return NextResponse.json({ error: "CJ_API_KEY isn't set on the server" }, { status: 503 });
  }
  try {
    return NextResponse.json(await syncCjTracking());
  } catch (err) {
    console.error("[cj-sync] failed:", err);
    return NextResponse.json({ error: "CJ sync failed" }, { status: 500 });
  }
}
