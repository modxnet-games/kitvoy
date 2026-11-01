import { NextRequest, NextResponse } from "next/server";

import { getCustomerSession } from "@/lib/auth/customer-session";
import {
  DEFAULT_AFTER_LOGIN,
  GOOGLE_STATE_COOKIE,
  checkGoogleProfile,
  googleConfig,
  googleRedirectUri,
  publicBaseUrl,
  readGoogleStateCookie,
  statesMatch,
  type GoogleProfile,
} from "@/lib/auth/google-oauth";
import { findOrCreateGoogleUser } from "@/lib/data/users";
import { saveSubscriberEmail } from "@/lib/subscribers";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const origin = request.nextUrl.origin;
  const base = publicBaseUrl(origin);
  const params = request.nextUrl.searchParams;
  const saved = readGoogleStateCookie(request.cookies.get(GOOGLE_STATE_COOKIE)?.value);
  const redirectTo = saved?.redirect ?? DEFAULT_AFTER_LOGIN;

  const finish = (path: string) => {
    const response = NextResponse.redirect(`${base}${path}`);
    // One use only, whatever the outcome
    response.cookies.delete({ name: GOOGLE_STATE_COOKIE, path: "/api/auth/google" });
    return response;
  };
  const fail = (error: string) => finish(`/login?error=${error}&redirect=${encodeURIComponent(redirectTo)}`);

  if (!saved || !statesMatch(saved.state, params.get("state"))) return fail("google_state");
  // The customer pressed Cancel on Google's screen, or Google refused the request
  if (params.get("error")) return fail("google_denied");
  const code = params.get("code");
  if (!code) return fail("google_denied");

  const { clientId, clientSecret, configured } = googleConfig();
  if (!configured) return fail("google_not_configured");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: googleRedirectUri(origin),
        grant_type: "authorization_code",
        code_verifier: saved.verifier,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!tokenRes.ok) {
      console.warn("[auth] Google token exchange failed:", tokenRes.status);
      return fail("google_token_failed");
    }
    const tokens = (await tokenRes.json()) as { access_token?: string };
    if (!tokens.access_token) return fail("google_token_failed");

    const userRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
      signal: AbortSignal.timeout(10_000),
    });
    if (!userRes.ok) return fail("google_profile_failed");

    const checked = checkGoogleProfile((await userRes.json()) as Partial<GoogleProfile>);
    if (!checked.ok) return fail(checked.error);

    const user = await findOrCreateGoogleUser(checked.profile);
    const session = await getCustomerSession();
    session.userId = user.id;
    session.email = user.email;
    session.fullName = user.fullName;
    session.loginAt = Date.now();
    await session.save();
    await saveSubscriberEmail(user.email, "google").catch(() => undefined);

    return finish(redirectTo);
  } catch (err) {
    console.error("[auth] Google sign-in failed:", err instanceof Error ? err.message : err);
    return fail("google_failed");
  }
}
