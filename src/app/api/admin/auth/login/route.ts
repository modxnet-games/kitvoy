import { NextResponse } from "next/server";
import { validateAdminCredentials } from "@/lib/auth/admin-auth";
import { signAdminToken } from "@/lib/auth/admin-jwt";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: "Username and password are required" },
        { status: 400 },
      );
    }

    if (!validateAdminCredentials(username.trim(), password)) {
      return NextResponse.json(
        { error: "Invalid username or password" },
        { status: 401 },
      );
    }

    const token = signAdminToken(username.trim());

    return NextResponse.json({
      token,
      user: { username: username.trim(), role: "admin" },
    });
  } catch {
    return NextResponse.json(
      { error: "Login failed" },
      { status: 500 },
    );
  }
}
