import { NextRequest, NextResponse } from "next/server";

import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { registerAdminDevice, removeAdminDevice } from "@/lib/push/admin-devices";

/**
 * POST /api/admin/devices  { token, platform: "android" | "ios" }
 * Registers (or refreshes) the Kitvoy app's FCM token for sale notifications.
 * DELETE /api/admin/devices  { token } — stops notifications on sign-out.
 * Accepts the mobile Bearer token or the dashboard session (same-origin JSON).
 */
export async function POST(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  try {
    const result = await registerAdminDevice(body?.token, body?.platform);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
    return NextResponse.json({ device: result.device });
  } catch (err) {
    console.error("[admin/devices] register failed:", err);
    return NextResponse.json({ error: "Failed to register the device" }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const body = await request.json().catch(() => null);
  try {
    return NextResponse.json({ removed: await removeAdminDevice(body?.token) });
  } catch (err) {
    console.error("[admin/devices] remove failed:", err);
    return NextResponse.json({ error: "Failed to remove the device" }, { status: 500 });
  }
}
