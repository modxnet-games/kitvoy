import type { MetaContent } from "@/lib/analytics/meta-pixel";
import type { PayPalAddressReason } from "@/lib/checkout/express-details";
import { EXPRESS_RETURN_PARAM, PAYPAL_ID_RE } from "@/lib/payments/paypal-ids";

/**
 * What the browser keeps and reads for a PayPal express payment: the marker
 * of an approval whose outcome it doesn't know yet, the reading of PayPal's
 * return to the checkout (redirect mode), and the reading of the server's
 * answer about an approval. No React here, so each is tested on its own.
 */

/* ---------- the approval marker ---------- */

/**
 * The buyer approved a PayPal order and the page hasn't learned how it ended:
 * it was reloaded while the payment was being confirmed, the answer never
 * arrived, or (redirect mode) the browser has left for PayPal. The marker is
 * what lets the page ask the server again instead of offering a second
 * payment. It holds the PayPal order id, when it was approved and which cart
 * it was for; nothing personal. Local storage, three hours: as long as PayPal
 * keeps an approval usable.
 */
export const EXPRESS_APPROVAL_KEY = "kitvoy-ppx";
export const EXPRESS_APPROVAL_TTL_MS = 3 * 60 * 60 * 1000;

export interface ExpressApproval {
  /** The PayPal order the buyer approved */
  id: string;
  /** When, in milliseconds since the epoch */
  at: number;
  /** The cart it was approved for, as the checkout page's cart key */
  cart: string;
}

const CART_KEY_MAX = 4000;

/** A stored marker that is still usable, or null (missing, malformed, older than three hours). */
export function parseExpressApproval(raw: string | null | undefined, now: number = Date.now()): ExpressApproval | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Record<keyof ExpressApproval, unknown>> | null;
    if (!value || typeof value !== "object") return null;
    const { id, at, cart } = value;
    if (typeof id !== "string" || !PAYPAL_ID_RE.test(id)) return null;
    if (typeof at !== "number" || !Number.isFinite(at)) return null;
    if (now - at >= EXPRESS_APPROVAL_TTL_MS || at > now + 60_000) return null;
    if (typeof cart !== "string" || cart.length > CART_KEY_MAX) return null;
    return { id, at, cart };
  } catch {
    return null;
  }
}

export function readExpressApproval(now: number = Date.now()): ExpressApproval | null {
  try {
    const raw = localStorage.getItem(EXPRESS_APPROVAL_KEY);
    const approval = parseExpressApproval(raw, now);
    if (raw && !approval) localStorage.removeItem(EXPRESS_APPROVAL_KEY);
    return approval;
  } catch {
    return null;
  }
}

/**
 * Notes that this PayPal order was approved for this cart. Asking about the
 * same approval again (a phone number added, a reload) keeps its first time:
 * the three hours run from the approval, not from the last look at it.
 */
export function rememberExpressApproval(id: string, cart: string, now: number = Date.now()): void {
  if (!PAYPAL_ID_RE.test(id) || cart.length > CART_KEY_MAX) return;
  try {
    const known = readExpressApproval(now);
    const approval: ExpressApproval = { id, at: known?.id === id ? known.at : now, cart };
    localStorage.setItem(EXPRESS_APPROVAL_KEY, JSON.stringify(approval));
  } catch {
    // Storage unavailable (private mode, quota): the payment still works, it just can't be asked about after a reload
  }
}

export function forgetExpressApproval(): void {
  try {
    localStorage.removeItem(EXPRESS_APPROVAL_KEY);
  } catch {
    // ignore
  }
}

/* ---------- coming back from PayPal (redirect mode) ---------- */

/**
 * What the URL says when PayPal sends an express buyer back to the checkout:
 * after approving ("return") or backing out ("cancel"), with PayPal's order
 * id as `token` when it is shaped like one. Null for any other URL, and for a
 * return to the payment step (`pp`), which has its own flow.
 */
export function expressReturnFromUrl(url: string): { kind: "return" | "cancel"; token: string | null } | null {
  try {
    const params = new URL(url, "https://kitvoy.com").searchParams;
    if (params.has("pp")) return null;
    const kind = params.get(EXPRESS_RETURN_PARAM);
    if (kind !== "return" && kind !== "cancel") return null;
    const token = params.get("token");
    return { kind, token: token !== null && PAYPAL_ID_RE.test(token) ? token : null };
  } catch {
    return null;
  }
}

/**
 * What a return from PayPal means for this browser, given the marker it kept
 * when it left:
 *
 * - "return": the buyer approved the PayPal order this browser opened; the
 *   server is asked to complete exactly that one.
 * - "cancel": the buyer backed out of it (or nothing is open here at all), so
 *   nothing was approved and nothing can be taken.
 * - "unknown": the URL names a PayPal order this browser has no marker for,
 *   or another one than its marker (a link from elsewhere, storage the web
 *   view dropped, a marker older than three hours). Nothing is completed and
 *   nothing is claimed about a charge; a marker for another order is kept.
 */
export type ExpressArrival = { kind: "return"; id: string } | { kind: "cancel" } | { kind: "unknown"; code: "no_marker" | "mismatch" };

export function expressArrival(back: ReturnType<typeof expressReturnFromUrl>, marker: ExpressApproval | null): ExpressArrival | null {
  if (!back) return null;
  const same = marker !== null && back.token === marker.id;
  if (back.kind === "return") return same && marker ? { kind: "return", id: marker.id } : { kind: "unknown", code: marker ? "mismatch" : "no_marker" };
  return same || !marker ? { kind: "cancel" } : { kind: "unknown", code: "mismatch" };
}

/** What PayPal's return adds to the URL; none of it is needed once the page has read it. */
const EXPRESS_RETURN_PARAMS = [EXPRESS_RETURN_PARAM, "token", "PayerID", "ba_token"];

/** The same URL without PayPal's express return parameters, so they never linger in the address bar or the history. Other URLs come back as they are. */
export function withoutExpressReturn(url: string): string {
  try {
    const parsed = new URL(url, "https://kitvoy.com");
    if (!parsed.searchParams.has(EXPRESS_RETURN_PARAM) || parsed.searchParams.has("pp")) return `${parsed.pathname}${parsed.search}${parsed.hash}`;
    for (const name of EXPRESS_RETURN_PARAMS) parsed.searchParams.delete(name);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

/** Removes PayPal's express return parameters from the address bar without a navigation. */
export function stripExpressReturnFromAddressBar(): void {
  try {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const clean = withoutExpressReturn(window.location.href);
    if (clean !== current) window.history.replaceState(window.history.state, "", clean);
  } catch {
    // ignore
  }
}

/* ---------- the server's answer about an approved payment ---------- */

/**
 * How the server says an approved payment ended, as the button acts on it.
 * "unconfirmed" covers everything that doesn't say: the server's own
 * "unconfirmed", no answer at all, an error page, an answer that can't be
 * read. Only "address_unusable", "price_changed" and "not_completed" may be
 * shown as "you haven't been charged".
 */
export type ExpressAnswer =
  | { status: "paid"; orderReference: string; total: number; contents?: MetaContent[] }
  | { status: "address_unusable"; reason: PayPalAddressReason }
  | { status: "needs_phone" }
  | { status: "price_changed" }
  | { status: "not_completed"; code: string }
  | { status: "unconfirmed"; code: string };

const ADDRESS_REASONS: readonly PayPalAddressReason[] = ["country", "state", "postal", "address"];
/** The route's own refusals: it turned the call away before reading anything. */
const ROUTE_OFF = ["PAYPAL_EXPRESS_OFF", "PAYPAL_NOT_CONFIGURED"];

/**
 * Reads the answer of PUT /api/checkout/paypal/express.
 *
 * Nothing but the route's own words counts as "not charged". An error page
 * from a proxy, a 5xx, a body that isn't the route's JSON or a status this
 * page doesn't know all say nothing about the charge, so they are
 * "unconfirmed". So is the route being switched off when this approval was
 * already asked about (`askedBefore`): the earlier call may have taken the
 * payment before its answer was lost.
 */
export function readExpressAnswer(httpStatus: number, body: unknown, askedBefore = false): ExpressAnswer {
  const json = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
  const ok = httpStatus >= 200 && httpStatus < 300;
  if (!ok || !json) {
    const off = httpStatus === 503 && typeof json?.error === "string" && ROUTE_OFF.includes(json.error);
    return off && !askedBefore ? { status: "not_completed", code: "http_503" } : { status: "unconfirmed", code: `http_${httpStatus}` };
  }

  switch (json.status) {
    case "paid":
      if (typeof json.orderReference !== "string" || typeof json.total !== "number") return { status: "unconfirmed", code: "bad_answer" };
      return { status: "paid", orderReference: json.orderReference, total: json.total, contents: Array.isArray(json.contents) ? (json.contents as MetaContent[]) : undefined };
    case "address_unusable":
      return { status: "address_unusable", reason: ADDRESS_REASONS.find((r) => r === json.reason) ?? "address" };
    case "needs_phone":
      return { status: "needs_phone" };
    case "price_changed":
      return { status: "price_changed" };
    case "not_completed":
      return { status: "not_completed", code: typeof json.code === "string" ? json.code : "unknown" };
    case "unconfirmed":
      return { status: "unconfirmed", code: typeof json.code === "string" ? json.code : "unknown" };
    default:
      return { status: "unconfirmed", code: "bad_answer" };
  }
}
