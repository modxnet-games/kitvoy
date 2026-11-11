import { formatCheckoutEvent, sanitizeCheckoutEvent } from "@/lib/checkout/events";

/** A whole checkout is a few dozen events; this is far above honest use and stops the log being flooded. */
const MAX_EVENTS_PER_MINUTE = 600;
const MAX_BODY_BYTES = 1024;

let windowStart = 0;
let windowCount = 0;

function underLimit(now: number): boolean {
  if (now - windowStart >= 60_000) {
    windowStart = now;
    windowCount = 0;
  }
  windowCount += 1;
  return windowCount <= MAX_EVENTS_PER_MINUTE;
}

const done = () => new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });

/**
 * POST /api/checkout/events
 *
 * Writes one checkout event to the server log (see lib/checkout/events). It
 * reads nothing but the event itself: no cookie, IP address or user agent,
 * and only fields of a known shape, so no personal data can end up in the log.
 * Always answers 204; logging must never be something a checkout waits for or
 * fails on.
 */
export async function POST(request: Request) {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return done();
    const event = sanitizeCheckoutEvent(JSON.parse(text));
    if (event && underLimit(Date.now())) console.info(formatCheckoutEvent(event));
  } catch {
    // Not JSON: nothing to log
  }
  return done();
}
