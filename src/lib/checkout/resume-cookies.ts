import type { NextRequest, NextResponse } from "next/server";

import { RESUME_COOKIE, RESUME_FLAG_COOKIE, SESSION_TTL_SECONDS, isCheckoutToken } from "./resume-token";

/** HTTPS as the visitor sees it (nginx and Cloudflare terminate TLS in front of the app). */
export function isSecureRequest(request: NextRequest): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  return (forwarded ?? request.nextUrl.protocol.replace(":", "")) === "https";
}

/** The session token the browser presents: the one it sends explicitly wins over its cookie. */
export function presentedSessionToken(request: NextRequest, fromBody: unknown): string | null {
  if (isCheckoutToken(fromBody)) return fromBody;
  const cookie = request.cookies.get(RESUME_COOKIE)?.value;
  return isCheckoutToken(cookie) ? cookie : null;
}

export function setResumeCookies(response: NextResponse, token: string, secure: boolean): void {
  const base = { maxAge: SESSION_TTL_SECONDS, path: "/", sameSite: "lax" as const, secure };
  response.cookies.set(RESUME_COOKIE, token, { ...base, httpOnly: true });
  response.cookies.set(RESUME_FLAG_COOKIE, "1", base);
}

export function clearResumeCookies(response: NextResponse): void {
  response.cookies.set(RESUME_COOKIE, "", { maxAge: 0, path: "/" });
  response.cookies.set(RESUME_FLAG_COOKIE, "", { maxAge: 0, path: "/" });
}
