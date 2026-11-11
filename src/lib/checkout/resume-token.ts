import { createHash, randomBytes } from "node:crypto";

/**
 * A started checkout can be picked up again: after a reload, when an in-app
 * browser throws the page away, or from another browser through a link.
 *
 * - A "session" token lives in the browser that is checking out (an HttpOnly
 *   cookie and local storage) for 48 hours from the last save. It never
 *   travels in a URL.
 * - A "link" token travels in a URL (open-in-browser hand-off, PayPal return,
 *   a recovery email), expires quickly, and is exchanged for a session token.
 *
 * The database holds only SHA-256 hashes, and every lookup of an order's
 * personal details goes through a token, never through its KTV reference.
 */
export * from "./resume-constants";

/** 256 random bits, URL-safe. */
export function newCheckoutToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What the database stores. The token is high-entropy, so a single SHA-256 is enough. */
export function hashCheckoutToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
