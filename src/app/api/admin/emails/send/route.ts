import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { sendAdminEmail, validateAdminEmail } from "@/lib/data/sent-emails";

/**
 * POST /api/admin/emails/send  { sender: "support" | "orders", to, subject, body, orderId? }
 * Sends a branded email from the VPS (Brevo only accepts SMTP from its IP) and
 * logs it. Accepts the mobile app's Bearer token or the dashboard session
 * cookie (same-origin JSON requests only).
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const input = await request.json().catch(() => null);
  if (!input || typeof input !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const valid = validateAdminEmail(input);
  if (!valid.ok) {
    return NextResponse.json({ error: "Please fix the highlighted fields", fields: valid.errors }, { status: 400 });
  }

  try {
    const result = await sendAdminEmail(valid.value);
    if (!result.ok) {
      return NextResponse.json({ error: result.error, email: "email" in result ? result.email : undefined }, { status: result.status });
    }
    return NextResponse.json({ email: result.email }, { status: 201 });
  } catch (err) {
    console.error("[admin/emails] send failed:", err);
    return NextResponse.json({ error: "Failed to send the email" }, { status: 500 });
  }
}
