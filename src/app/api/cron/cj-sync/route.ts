import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { isCjConfigured } from "@/config/fulfillment";
import { syncCjTracking } from "@/lib/fulfillment/cj";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || provided.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
}

/**
 * GET /api/cron/cj-sync  (Authorization: Bearer $CRON_SECRET)
 * Run on a schedule to mark CJ orders shipped/delivered and email tracking.
 */
export async function GET(request: Request) {
  if (!isAuthorized(request)) {
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
