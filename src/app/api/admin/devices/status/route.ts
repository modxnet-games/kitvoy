import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { getAdminDeviceStatus } from "@/lib/push/admin-devices";

/**
 * POST /api/admin/devices/status  { token }
 * Whether the Kitvoy app on this phone is registered for sale notifications.
 * The token goes in the body, not the URL, so it stays out of access logs.
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  try {
    return NextResponse.json(await getAdminDeviceStatus(body?.token));
  } catch (err) {
    console.error("[admin/devices/status] failed:", err);
    return NextResponse.json({ error: "Failed to check this phone" }, { status: 500 });
  }
}
