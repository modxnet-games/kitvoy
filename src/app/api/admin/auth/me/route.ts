import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import { isAuthorizedAdminRequest } from "@/lib/auth/admin-request";
import { getAdminSession } from "@/lib/auth/admin-session";

export async function GET(request: NextRequest) {
  // The app's token carries its user; a dashboard session carries the name it signed in with
  const admin = getAdminFromRequest(request);
  if (admin) {
    return NextResponse.json({
      username: admin.username,
      role: admin.role,
    });
  }
  if (!(await isAuthorizedAdminRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const session = await getAdminSession();
  return NextResponse.json({
    username: session.username,
    role: "admin",
  });
}
