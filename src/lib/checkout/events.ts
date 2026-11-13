/**
 * The checkout's own event log: what happened on the way to paying, never who
 * it happened to. One line per event in the server log, so a checkout that
 * went wrong can be read back step by step (did the card form load, was Pay
 * tapped, what did Stripe say, did the page go to the background).
 *
 * An event carries only: its name, the order reference once there is one, the
 * in-app browser (if any), a timing or a short code, the screen width, and a
 * random id that lasts for one page load. No name, email, address, IP address,
 * user agent or cookie is read or stored. No Node imports here: the browser
 * uses the same list.
 */
export const CHECKOUT_EVENTS = [
  "checkout_opened",
  "checkout_restored",
  "details_saved",
  "stripe_ready",
  "stripe_load_error",
  "pay_clicked",
  "pay_validation_error",
  "pay_error",
  "pay_succeeded",
  "paypal_clicked",
  "paypal_redirected",
  "paypal_returned",
  "paypal_approved",
  "paypal_canceled",
  "paypal_error",
  "open_in_browser",
  "payment_hidden",
  "payment_visible",
  "express_shown",
  "express_clicked",
  "express_failed",
] as const;

export type CheckoutEventName = (typeof CHECKOUT_EVENTS)[number];

export interface CheckoutEvent {
  e: CheckoutEventName;
  /** KTV-… once the order exists */
  ref?: string;
  /** facebook | instagram | threads, when in one of Meta's in-app browsers */
  app?: string;
  /** 1 = details, 2 = payment */
  step?: 1 | 2;
  /** A duration in milliseconds (how long the card form took, how long the page was hidden) */
  ms?: number;
  /** A short machine code: Stripe's error code, "reused", "cancel", the express methods on offer ("apple_pay,paypal")… */
  code?: string;
  /** Screen width in CSS pixels */
  w?: number;
  /** Random, per page load: ties one visit's lines together and means nothing after it */
  sid?: string;
}

const REFERENCE_RE = /^KTV-[A-Z0-9]{8}$/;
const CODE_RE = /^[A-Za-z0-9_.:,-]{1,48}$/;
const SID_RE = /^[a-z0-9]{6,12}$/;
const APPS = new Set(["facebook", "instagram", "threads"]);

const int = (value: unknown, max: number) =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= max ? Math.round(value) : undefined;

/**
 * The event as it may be logged, or null. Anything that isn't on the list or
 * doesn't have the expected shape is dropped, so free text can never reach the log.
 */
export function sanitizeCheckoutEvent(input: unknown): CheckoutEvent | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as Record<string, unknown>;
  if (typeof raw.e !== "string" || !(CHECKOUT_EVENTS as readonly string[]).includes(raw.e)) return null;
  const event: CheckoutEvent = { e: raw.e as CheckoutEventName };
  if (typeof raw.ref === "string" && REFERENCE_RE.test(raw.ref)) event.ref = raw.ref;
  if (typeof raw.app === "string" && APPS.has(raw.app)) event.app = raw.app;
  if (raw.step === 1 || raw.step === 2) event.step = raw.step;
  const ms = int(raw.ms, 3_600_000);
  if (ms !== undefined) event.ms = ms;
  if (typeof raw.code === "string" && CODE_RE.test(raw.code)) event.code = raw.code;
  const w = int(raw.w, 10_000);
  if (w !== undefined) event.w = w;
  if (typeof raw.sid === "string" && SID_RE.test(raw.sid)) event.sid = raw.sid;
  return event;
}

/** One log line: a timestamp and the event, as JSON after a fixed tag that is easy to grep. */
export function formatCheckoutEvent(event: CheckoutEvent, now: Date = new Date()): string {
  return `[checkout] ${JSON.stringify({ t: now.toISOString(), ...event })}`;
}
