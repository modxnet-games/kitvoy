import type { NextRequest } from "next/server";

import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import { isAdminAuthenticated } from "@/lib/auth/admin-session";

/**
 * Authorizes an admin API request from either client:
 * - the mobile admin app, with `Authorization: Bearer <jwt>`
 * - the web dashboard, with its session cookie. Cookie-authenticated writes
 *   must come from this site (Origin check) with a JSON body, so another
 *   website can't make a logged-in admin's browser change orders.
 */
export async function isAuthorizedAdminRequest(request: NextRequest): Promise<boolean> {
  if (getAdminFromRequest(request)) return true;

  const isWrite = !["GET", "HEAD", "OPTIONS"].includes(request.method);
  if (isWrite) {
    const origin = request.headers.get("origin");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
    if (!origin || !host) return false;
    try {
      if (new URL(origin).host !== host) return false;
    } catch {
      return false;
    }
    if (!request.headers.get("content-type")?.includes("application/json")) return false;
  }

  return isAdminAuthenticated();
}
