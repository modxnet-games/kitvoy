import type { CheckoutEvent, CheckoutEventName } from "@/lib/checkout/events";
import { detectInAppBrowser } from "@/lib/in-app-browser";

/** A whole checkout is a few dozen events; a page stuck in a loop must not flood the log. */
const MAX_EVENTS_PER_PAGE = 60;

let sent = 0;
let pageId: string | null = null;

/** Random and only for this page load: it ties one visit's lines together, and is never stored. */
function pageLoadId(): string {
  if (!pageId) pageId = Math.random().toString(36).slice(2, 10).padEnd(8, "0");
  return pageId;
}

/**
 * Records one step of the checkout in the server log: what happened, never
 * who. Sent with sendBeacon, so it still goes out when the page is being
 * hidden or thrown away, which is exactly when it matters most. Never throws
 * and never waits.
 */
export function logCheckoutEvent(name: CheckoutEventName, data: Pick<CheckoutEvent, "ref" | "step" | "ms" | "code"> = {}): void {
  if (typeof window === "undefined" || sent >= MAX_EVENTS_PER_PAGE) return;
  sent += 1;
  try {
    const event: CheckoutEvent = {
      e: name,
      ...data,
      app: detectInAppBrowser(navigator.userAgent) ?? undefined,
      w: window.innerWidth,
      sid: pageLoadId(),
    };
    const body = JSON.stringify(event);
    // A plain string body: the simplest thing a beacon can carry, and the route parses it as JSON whatever its type
    const queued = typeof navigator.sendBeacon === "function" && navigator.sendBeacon("/api/checkout/events", body);
    if (!queued) {
      void fetch("/api/checkout/events", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  } catch {
    // Logging is never worth breaking a checkout for
  }
}
