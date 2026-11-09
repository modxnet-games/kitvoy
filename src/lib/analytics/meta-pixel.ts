/**
 * Meta Pixel in the browser. Every event goes through track(), which gives it
 * an event_id and refuses an empty event name, so Events Manager never sees a
 * "__missing_event" from this code. The server sends the same events with the
 * same event_id through the Conversions API (see meta-capi.ts), and Meta keeps
 * one of the pair.
 */

import { META_PIXEL_ID } from "@/config/analytics";

type Fbq = ((...args: unknown[]) => void) & { callMethod?: (...args: unknown[]) => void; queue?: unknown[]; loaded?: boolean; version?: string; push?: unknown };

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
    /** Set once fbq('init') ran, whichever copy of this module ran it */
    __kitvoyPixelInit?: boolean;
    /** The path the last PageView was sent for */
    __kitvoyPixelPath?: string;
  }
  interface Navigator {
    /** Global Privacy Control: the visitor asked sites not to sell or share their data */
    globalPrivacyControl?: boolean;
  }
}

export type MetaEventName = "PageView" | "ViewContent" | "AddToCart" | "InitiateCheckout" | "Purchase";

/** A line of the cart or order, as Meta's `contents` parameter wants it. */
export interface MetaContent {
  id: string;
  quantity: number;
  item_price?: number;
}

export interface TrackableItem {
  product: { id: string; sku: string; name: string; price: number };
  quantity: number;
}

const FBEVENTS_SRC = "https://connect.facebook.net/en_US/fbevents.js";

/** True when the visitor's browser sends Global Privacy Control; the pixel then never loads. */
export function hasPrivacyOptOut(): boolean {
  return typeof navigator !== "undefined" && navigator.globalPrivacyControl === true;
}

/** Pages the pixel ignores (the store's own admin). */
export function isUntrackedPath(pathname: string): boolean {
  return pathname.startsWith("/admin");
}

/** A UUID for event_id; falls back to a random string where crypto.randomUUID is missing. */
export function newEventId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The SKU when the product has one, else its id: the same `content_ids` the server sends. */
export const contentId = (product: { id: string; sku: string }) => product.sku || product.id;

export function toContents(items: TrackableItem[]): MetaContent[] {
  return items.map((i) => ({ id: contentId(i.product), quantity: i.quantity, item_price: round2(i.product.price) }));
}

export const countItems = (items: TrackableItem[]) => items.reduce((n, i) => n + i.quantity, 0);

/**
 * Loads fbevents.js and runs `fbq('init')` exactly once per page load (Meta's
 * base code, without the PageView: that is sent by trackPageView so it can't
 * double up). Safe to call again; later calls do nothing. The guard lives on
 * window, so two bundled copies of this module still init once.
 */
export function ensurePixel(): void {
  if (typeof window === "undefined" || window.__kitvoyPixelInit) return;
  window.__kitvoyPixelInit = true;

  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    window.fbq = fbq;
    if (!window._fbq) window._fbq = fbq;
    if (!document.querySelector(`script[src="${FBEVENTS_SRC}"]`)) {
      const script = document.createElement("script");
      script.async = true;
      script.src = FBEVENTS_SRC;
      document.head.appendChild(script);
    }
  }
  window.fbq("init", META_PIXEL_ID);
}

/**
 * Sends one standard event with an event_id. Returns the id, or null when
 * nothing was sent (no pixel, or a bad event name).
 */
export function track(name: MetaEventName, params: Record<string, unknown> = {}, eventId: string = newEventId()): string | null {
  if (typeof window === "undefined") return null;
  if (typeof name !== "string" || name.trim() === "" || typeof eventId !== "string" || eventId === "") return null;
  // A page's own events (ViewContent) can run before the layout's pixel effect:
  // load the pixel now, and the stub queues the event until fbevents.js arrives
  if (typeof window.fbq !== "function") {
    if (hasPrivacyOptOut() || isUntrackedPath(window.location.pathname)) return null;
    ensurePixel();
  }
  if (typeof window.fbq !== "function") return null;
  window.fbq("track", name, params, { eventID: eventId });
  return eventId;
}

/** One PageView per path; the client-side router changes the path without a page load. */
export function trackPageView(pathname: string): void {
  if (typeof window === "undefined" || window.__kitvoyPixelPath === pathname) return;
  window.__kitvoyPixelPath = pathname;
  track("PageView");
}

export function trackViewContent(product: { id: string; sku: string; name: string; price: number }): void {
  track("ViewContent", {
    currency: "USD",
    value: round2(product.price),
    content_ids: [contentId(product)],
    content_type: "product",
    content_name: product.name,
  });
}

/** `value` is what the added quantity costs (bundle pricing included), not the whole cart. */
export function trackAddToCart(items: TrackableItem[], value: number): void {
  if (items.length === 0) return;
  track("AddToCart", {
    currency: "USD",
    value: round2(value),
    content_ids: items.map((i) => contentId(i.product)),
    content_type: "product",
    contents: toContents(items),
    num_items: countItems(items),
  });
}

/** Returns the event_id so the order can carry it to the server for de-duplication. */
export function trackInitiateCheckout(items: TrackableItem[], value: number, eventId: string = newEventId()): string | null {
  if (items.length === 0) return null;
  return track(
    "InitiateCheckout",
    {
      currency: "USD",
      value: round2(value),
      content_ids: items.map((i) => contentId(i.product)),
      content_type: "product",
      contents: toContents(items),
      num_items: countItems(items),
    },
    eventId,
  );
}

const PURCHASE_KEY = "kitvoy-purchase-tracked";

/** Remembers which orders this browser already counted, so a refresh of the thank-you page can't count twice. */
function claimPurchase(orderReference: string): boolean {
  try {
    const seen: string[] = JSON.parse(localStorage.getItem(PURCHASE_KEY) ?? "[]");
    if (seen.includes(orderReference)) return false;
    localStorage.setItem(PURCHASE_KEY, JSON.stringify([...seen.slice(-19), orderReference]));
  } catch {
    // Storage unavailable (private mode): track once per page load instead
  }
  return true;
}

export interface PurchaseData {
  /** KTV-… reference: the event_id on both the browser and the server event */
  orderReference: string;
  /** The amount actually charged, after bundle savings */
  value: number;
  contents: MetaContent[];
}

/**
 * Standard Purchase event, sent once the payment has been captured. The
 * event_id is the order reference, so Meta can de-duplicate it against the
 * server-side event from the payment webhook. Once per order per browser.
 */
export function trackPurchase(p: PurchaseData): boolean {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return false;
  if (!claimPurchase(p.orderReference)) return false;
  const quantity = p.contents.reduce((n, c) => n + c.quantity, 0);
  track(
    "Purchase",
    {
      currency: "USD",
      value: round2(p.value),
      content_ids: p.contents.map((c) => c.id),
      content_type: "product",
      contents: p.contents,
      num_items: quantity,
      order_id: p.orderReference,
    },
    p.orderReference,
  );
  return true;
}
