import { NextResponse } from "next/server";

import { isCjConfigured } from "@/config/fulfillment";
import { isCronAuthorized } from "@/lib/cron-auth";
import { syncCjTracking } from "@/lib/fulfillment/cj";

/**
 * GET /api/cron/cj-sync  (Authorization: Bearer $CRON_SECRET)
 * Run on a schedule to mark CJ orders shipped/delivered and email tracking.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  if (!isCjConfigured()) {
    return NextResponse.json({ error: "CJ_API_KEY isn't set" }, { status: 503 });
  }
  try {
    const result = await syncCjTracking();
    if (result.shipped || result.delivered || result.errors.length) console.info("[cj-sync]", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[cj-sync] failed:", err);
    return NextResponse.json({ error: "CJ sync failed" }, { status: 500 });
  }
}
