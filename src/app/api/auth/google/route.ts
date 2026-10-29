import { NextRequest, NextResponse } from "next/server";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL?.trim() ?? "";

function getPublicBaseUrl(origin: string): string {
  if (APP_URL) return APP_URL.replace(/\/+$/, "");
  return origin.replace(/\/+$/, "");
}

function resolveRedirectUri(origin: string): string {
  const configured = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (configured) return configured;
  if (APP_URL) return `${APP_URL.replace(/\/+$/, "")}/api/auth/google/callback`;
  return `${origin}/api/auth/google/callback`;
}

function sanitizeRedirectPath(raw: string | null): string {
  if (!raw) return "/shop";
  const value = raw.trim();
  if (!value.startsWith("/")) return "/shop";
  if (value.startsWith("//")) return "/shop";
  return value;
}

export async function GET(request: NextRequest) {
  const publicBaseUrl = getPublicBaseUrl(request.nextUrl.origin);
  if (!CLIENT_ID) {
    return NextResponse.redirect(
      `${publicBaseUrl}/login?error=google_not_configured`,
    );
  }

  const redirectTo = sanitizeRedirectPath(
    request.nextUrl.searchParams.get("redirect"),
  );
  const redirectUri = resolveRedirectUri(request.nextUrl.origin);

  const state = Buffer.from(JSON.stringify({ redirect: redirectTo })).toString(
    "base64url",
  );

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
    state,
  });

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
  );
}
