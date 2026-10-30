import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { listSentEmails } from "@/lib/data/sent-emails";

/** GET /api/admin/emails?orderId=&limit= — emails sent from the admin, newest first. */
export async function GET(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const limit = Number(params.get("limit"));
  try {
    const emails = await listSentEmails({
      orderId: params.get("orderId") || undefined,
      limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
    });
    return NextResponse.json({ emails });
  } catch (err) {
    console.error("[admin/emails] list failed:", err);
    return NextResponse.json({ error: "Failed to load emails" }, { status: 500 });
  }
}
