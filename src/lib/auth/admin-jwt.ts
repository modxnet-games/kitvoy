import jwt from "jsonwebtoken";
import { NextRequest } from "next/server";

const JWT_SECRET = process.env.SESSION_SECRET || "dev-fallback-min-32-characters-long!!!";
const TOKEN_EXPIRY = "7d";

interface AdminTokenPayload {
  username: string;
  role: "admin";
  iat?: number;
  exp?: number;
}

/** Sign a JWT for the admin user. */
export function signAdminToken(username: string): string {
  return jwt.sign({ username, role: "admin" } satisfies AdminTokenPayload, JWT_SECRET, {
    expiresIn: TOKEN_EXPIRY,
  });
}

/** Verify a JWT and return the payload, or null if invalid/expired. */
export function verifyAdminToken(token: string): AdminTokenPayload | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    if (payload.role !== "admin") return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Extract and verify the admin JWT from the Authorization header.
 * Returns the payload if valid, or null if missing/invalid.
 */
export function getAdminFromRequest(request: NextRequest): AdminTokenPayload | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice(7);
  return verifyAdminToken(token);
}
