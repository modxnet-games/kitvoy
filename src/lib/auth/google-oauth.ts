import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Google OAuth 2.0 (authorization code + PKCE) for customer sign-in.
 * The start route stores a random state and the PKCE verifier in a short-lived
 * httpOnly cookie; the callback only accepts a response whose state matches
 * that cookie, so another site can't sign a visitor into someone else's account.
 */

export const GOOGLE_STATE_COOKIE = "kitvoy_google_oauth";
export const GOOGLE_STATE_TTL_SECONDS = 10 * 60;
export const DEFAULT_AFTER_LOGIN = "/account";

const AUTH_ENDPOINT = "https://accounts.google.com/o/oauth2/v2/auth";

export function googleConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? "";
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim() ?? "";
  return { clientId, clientSecret, configured: !!clientId && !!clientSecret };
}

export function publicBaseUrl(requestOrigin: string): string {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  return (appUrl || requestOrigin).replace(/\/+$/, "");
}

/** Must exactly match an authorized redirect URI on the Google OAuth client. */
export function googleRedirectUri(requestOrigin: string): string {
  return process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() || `${publicBaseUrl(requestOrigin)}/api/auth/google/callback`;
}

/** Same-site paths only: "//host", "/\host", backslashes and control characters fall back. */
export function safeRedirectPath(raw: string | null | undefined, fallback = DEFAULT_AFTER_LOGIN): string {
  const value = raw?.trim() ?? "";
  if (!value.startsWith("/") || value.startsWith("//") || /[\\\u0000-\u001f\u007f]/.test(value)) return fallback;
  return value;
}

const SHOWN_ERRORS = ["google_not_configured", "google_denied", "google_state", "google_unverified"];

/** The ?error= code the login page explains; other Google failures share one message. */
export function googleErrorCode(raw: string | null | undefined): string | undefined {
  if (!raw?.startsWith("google_")) return undefined;
  return SHOWN_ERRORS.includes(raw) ? raw : "google_failed";
}

export interface GoogleStateCookie {
  state: string;
  verifier: string;
  redirect: string;
}

export function createGoogleAuthRequest(clientId: string, redirectUri: string, redirect: string) {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const url = `${AUTH_ENDPOINT}?${new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    prompt: "select_account",
  })}`;
  const cookie: GoogleStateCookie = { state, verifier, redirect: safeRedirectPath(redirect) };
  return { url, cookie: Buffer.from(JSON.stringify(cookie)).toString("base64url") };
}

export function readGoogleStateCookie(raw: string | undefined): GoogleStateCookie | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Partial<GoogleStateCookie>;
    if (typeof parsed.state !== "string" || typeof parsed.verifier !== "string" || typeof parsed.redirect !== "string") return null;
    return { state: parsed.state, verifier: parsed.verifier, redirect: safeRedirectPath(parsed.redirect) };
  } catch {
    return null;
  }
}

export function statesMatch(expected: string, received: string | null): boolean {
  if (!received) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(received);
  return a.length === b.length && a.length > 0 && timingSafeEqual(a, b);
}

/** Google's OpenID Connect userinfo response. */
export interface GoogleProfile {
  sub: string;
  email: string;
  email_verified?: boolean;
  name?: string;
  given_name?: string;
  picture?: string;
}

export type GoogleProfileCheck =
  | { ok: true; profile: { googleId: string; email: string; fullName: string; image?: string } }
  | { ok: false; error: "google_profile_failed" | "google_unverified" };

/**
 * Accounts are matched on email, so only an address Google has verified may
 * create or link one; otherwise anyone could claim an existing customer's account.
 */
export function checkGoogleProfile(profile: Partial<GoogleProfile>): GoogleProfileCheck {
  const email = profile.email?.trim().toLowerCase();
  if (!profile.sub || !email) return { ok: false, error: "google_profile_failed" };
  if (profile.email_verified !== true) return { ok: false, error: "google_unverified" };
  const fullName = (profile.name || profile.given_name || email.split("@")[0]).trim().slice(0, 120);
  return { ok: true, profile: { googleId: profile.sub, email, fullName, image: profile.picture || undefined } };
}
