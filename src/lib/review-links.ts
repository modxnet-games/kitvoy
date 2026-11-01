import { createHmac, timingSafeEqual } from "node:crypto";

import { siteConfig } from "@/config/site";

/* Signed review links for the post-delivery email: the link itself proves the
   customer received that order's email, so they can review without signing in. */

const ORDER_ID_RE = /^[a-z0-9]{20,40}$/i;

function reviewSecret(): string | null {
  const secret = process.env.SESSION_SECRET?.trim();
  return secret && secret.length >= 32 ? secret : null;
}

function signOrder(orderId: string, secret: string): string {
  return createHmac("sha256", secret).update(`kitvoy-review-link:${orderId}`).digest("base64url").slice(0, 32);
}

/** "<orderId>.<signature>" */
export function createReviewToken(orderId: string, secret = reviewSecret()): string {
  if (!secret) throw new Error("SESSION_SECRET must be set (32+ characters) to sign review links");
  return `${orderId}.${signOrder(orderId, secret)}`;
}

/** The order id a review link was signed for, or null when it's malformed or forged. */
export function readReviewToken(token: string | null | undefined, secret = reviewSecret()): string | null {
  if (!token || !secret) return null;
  const dot = token.indexOf(".");
  const orderId = token.slice(0, dot);
  if (dot < 1 || !ORDER_ID_RE.test(orderId)) return null;
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(signOrder(orderId, secret));
  return given.length === expected.length && timingSafeEqual(given, expected) ? orderId : null;
}

export function reviewLink(orderId: string): string {
  return new URL(`/review/${createReviewToken(orderId)}`, siteConfig.url).toString();
}
