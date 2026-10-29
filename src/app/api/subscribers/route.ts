import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, source = "newsletter" } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      return NextResponse.json({ error: "Invalid email" }, { status: 400 });
    }

    // Upsert: if email exists, don't overwrite — just skip
    await prisma.emailSubscriber.upsert({
      where: { email: email.trim().toLowerCase() },
      update: {}, // Don't update if already exists
      create: {
        email: email.trim().toLowerCase(),
        source: source || "newsletter",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Subscriber error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
