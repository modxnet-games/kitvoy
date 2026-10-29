import { NextRequest, NextResponse } from "next/server";
import { findOrCreateGoogleUser } from "@/lib/data/users";
import { getCustomerSession } from "@/lib/auth/customer-session";
import { saveSubscriberEmail } from "@/lib/subscribers";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
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

function sanitizeRedirectPath(raw: string): string {
  const value = raw.trim();
  if (!value.startsWith("/")) return "/shop";
  if (value.startsWith("//")) return "/shop";
  return value;
}

interface GoogleTokenResponse {
  access_token: string;
  id_token: string;
  token_type: string;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  email_verified: boolean;
}

export async function GET(request: NextRequest) {
  const appOrigin = request.nextUrl.origin;
  const publicBaseUrl = getPublicBaseUrl(appOrigin);
  const redirectUri = resolveRedirectUri(appOrigin);

  const code = request.nextUrl.searchParams.get("code");
  const stateParam = request.nextUrl.searchParams.get("state");

  let redirectTo = "/shop";
  if (stateParam) {
    try {
      const decoded = JSON.parse(
        Buffer.from(stateParam, "base64url").toString(),
      );
      if (decoded.redirect && typeof decoded.redirect === "string") {
        redirectTo = sanitizeRedirectPath(decoded.redirect);
      }
    } catch {}
  }

  if (!code) {
    return NextResponse.redirect(
      `${publicBaseUrl}/login?error=google_denied&redirect=${encodeURIComponent(redirectTo)}`,
    );
  }

  if (!CLIENT_ID || !CLIENT_SECRET) {
    return NextResponse.redirect(
      `${publicBaseUrl}/login?error=google_not_configured&redirect=${encodeURIComponent(redirectTo)}`,
    );
  }

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      return NextResponse.redirect(
        `${publicBaseUrl}/login?error=google_token_failed&redirect=${encodeURIComponent(redirectTo)}`,
      );
    }

    const tokens: GoogleTokenResponse = await tokenRes.json();

    const userRes = await fetch(
      "https://www.googleapis.com/oauth2/v3/userinfo",
      { headers: { Authorization: `Bearer ${tokens.access_token}` } },
    );

    if (!userRes.ok) {
      return NextResponse.redirect(
        `${publicBaseUrl}/login?error=google_profile_failed&redirect=${encodeURIComponent(redirectTo)}`,
      );
    }

    const profile: GoogleUserInfo = await userRes.json();

    const user = await findOrCreateGoogleUser({
      googleId: profile.sub,
      email: profile.email,
      fullName: profile.name,
      image: profile.picture,
    });

    const session = await getCustomerSession();
    session.userId = user.id;
    session.email = user.email;
    session.fullName = user.fullName;
    session.loginAt = Date.now();
    await session.save();
    await saveSubscriberEmail(user.email, "google");

    return NextResponse.redirect(`${publicBaseUrl}${redirectTo}`);
  } catch {
    return NextResponse.redirect(
      `${publicBaseUrl}/login?error=google_failed&redirect=${encodeURIComponent(redirectTo)}`,
    );
  }
}
