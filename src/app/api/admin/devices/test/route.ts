import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { sendTestSalePush } from "@/lib/push/admin-devices";

/** POST /api/admin/devices/test — sends a sample sale push to every registered phone. */
export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const summary = await sendTestSalePush();
    if (!summary.configured) {
      return NextResponse.json({ ...summary, error: "Push isn't set up on the server yet (FIREBASE_SERVICE_ACCOUNT_BASE64)" }, { status: 503 });
    }
    if (!summary.devices) {
      return NextResponse.json({ ...summary, error: "No phones are registered yet. Open the Kitvoy app and allow notifications." }, { status: 404 });
    }
    return NextResponse.json(summary, { status: summary.sent ? 200 : 502 });
  } catch (err) {
    console.error("[admin/devices/test] failed:", err);
    return NextResponse.json({ error: "Failed to send the test notification" }, { status: 500 });
  }
}
