import { NextRequest, NextResponse } from "next/server";

import {
  GOOGLE_STATE_COOKIE,
  GOOGLE_STATE_TTL_SECONDS,
  createGoogleAuthRequest,
  googleConfig,
  googleRedirectUri,
  publicBaseUrl,
  safeRedirectPath,
} from "@/lib/auth/google-oauth";

export const dynamic = "force-dynamic";

/** Starts Google sign-in: /api/auth/google?redirect=/checkout */
export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const base = publicBaseUrl(origin);
  const redirect = safeRedirectPath(request.nextUrl.searchParams.get("redirect"));
  const { clientId, configured } = googleConfig();
  if (!configured) {
    return NextResponse.redirect(`${base}/login?error=google_not_configured&redirect=${encodeURIComponent(redirect)}`);
  }

  const { url, cookie } = createGoogleAuthRequest(clientId, googleRedirectUri(origin), redirect);
  const response = NextResponse.redirect(url);
  response.cookies.set(GOOGLE_STATE_COOKIE, cookie, {
    httpOnly: true,
    secure: base.startsWith("https"),
    // Lax still sends it on Google's top-level redirect back to the callback
    sameSite: "lax",
    path: "/api/auth/google",
    maxAge: GOOGLE_STATE_TTL_SECONDS,
  });
  return response;
}
