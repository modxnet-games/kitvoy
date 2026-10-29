import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import { prisma } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const admin = getAdminFromRequest(req);
    if (!admin) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== "string" || !token.startsWith("ExpoPushToken[")) {
      return NextResponse.json({ error: "Invalid Expo push token" }, { status: 400 });
    }

    // Upsert the token to guarantee it is registered and updated chronologically
    await (prisma as any).adminDevice.upsert({
      where: { token },
      update: { updatedAt: new Date() },
      create: { token },
    });

    return NextResponse.json({ success: true, message: "Push token registered successfully" });
  } catch (error) {
    console.error("[PushTokenRegistration] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
