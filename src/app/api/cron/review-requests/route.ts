import { NextResponse } from "next/server";

import { isCronAuthorized } from "@/lib/cron-auth";
import { sendDueReviewRequests } from "@/lib/review-requests";

export const dynamic = "force-dynamic";

/**
 * GET /api/cron/review-requests  (Authorization: Bearer $CRON_SECRET)
 * Run once a day: emails a review link to customers whose order was delivered
 * a few days ago. Each order is asked once.
 */
export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }
  try {
    const result = await sendDueReviewRequests();
    if (result.due) console.info("[review-requests]", JSON.stringify(result));
    return NextResponse.json(result);
  } catch (err) {
    console.error("[review-requests] failed:", err);
    return NextResponse.json({ error: "Review requests failed" }, { status: 500 });
  }
}
