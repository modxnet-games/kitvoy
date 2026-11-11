/**
 * Names and shapes shared by the server and the browser for resuming a
 * checkout. No Node imports here, so the client bundle can use it.
 */
export type CheckoutTokenKind = "session" | "link";

export const SESSION_TTL_MS = 48 * 60 * 60 * 1000;
export const SESSION_TTL_SECONDS = SESSION_TTL_MS / 1000;
/** "Open in your browser": used within moments of being made. */
export const HANDOFF_LINK_TTL_MS = 15 * 60 * 1000;
/** PayPal's return and cancel URLs: long enough to log in and approve. */
export const PAYPAL_LINK_TTL_MS = 3 * 60 * 60 * 1000;
/** A link the owner emails to a customer whose checkout failed. */
export const RECOVERY_LINK_TTL_MS = 48 * 60 * 60 * 1000;

/** HttpOnly cookie holding the session token. */
export const RESUME_COOKIE = "kv_co";
/** Readable flag ("1") that only says the cookie above exists, so the page knows to ask the server. */
export const RESUME_FLAG_COOKIE = "kv_co_s";
/** The query parameter (or #fragment key) a link token arrives in. */
export const RESUME_LINK_PARAM = "r";

const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export function isCheckoutToken(value: unknown): value is string {
  return typeof value === "string" && TOKEN_RE.test(value);
}

/** An unpaid, uncanceled order: the one a retry updates instead of duplicating. */
export function isOpenOrder(order: { status: string; paymentStatus: string }): boolean {
  return order.status === "PENDING" && order.paymentStatus === "unpaid";
}
