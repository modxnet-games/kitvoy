import { createHash } from "node:crypto";

import { META_PIXEL_ID } from "@/config/analytics";
import { prisma } from "@/lib/db";
import type { OrderAttribution } from "@/lib/analytics/attribution";

/**
 * Meta Conversions API: the server-side copy of the pixel's events, sent with
 * the same event_id so Meta keeps one of the pair. Configured only by
 * environment variables; without META_CAPI_ACCESS_TOKEN nothing is sent.
 * Every failure is logged and swallowed: tracking never breaks checkout or a
 * webhook's response.
 */

const GRAPH_API_VERSION = process.env.META_GRAPH_API_VERSION?.trim() || "v26.0";
const REQUEST_TIMEOUT_MS = 5000;

const orderReference = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;

export function getMetaCapiConfig(): { pixelId: string; accessToken: string; testEventCode?: string } | null {
  const accessToken = process.env.META_CAPI_ACCESS_TOKEN?.trim();
  if (!accessToken) return null;
  const pixelId = process.env.META_PIXEL_ID?.trim() || META_PIXEL_ID;
  const testEventCode = process.env.META_TEST_EVENT_CODE?.trim() || undefined;
  return { pixelId, accessToken, testEventCode };
}

/* ---------- user_data normalisation and hashing (Meta's rules) ---------- */

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
const hashOrSkip = (normalized: string | undefined) => (normalized ? sha256(normalized) : undefined);

const lower = (s: string | undefined | null) => (s ?? "").trim().toLowerCase();

/** em: lowercase, no surrounding whitespace */
export const normalizeEmail = (email: string | undefined | null) => {
  const e = lower(email);
  return e.includes("@") ? e : undefined;
};

/** ph: digits only, with the country code; US numbers get their leading 1 */
export const normalizePhone = (phone: string | undefined | null, country = "us") => {
  let digits = (phone ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (!digits) return undefined;
  if (country === "us" && digits.length === 10) digits = `1${digits}`;
  return digits.length >= 7 ? digits : undefined;
};

/** fn / ln / ct: lowercase letters only, no punctuation, digits or spaces */
export const normalizeName = (s: string | undefined | null) => {
  const n = lower(s).normalize("NFKD").replace(/[^\p{L}]/gu, "");
  return n || undefined;
};

/** st: two-letter lowercase state code */
export const normalizeState = (s: string | undefined | null) => {
  const st = lower(s).replace(/[^a-z]/g, "");
  return st.length === 2 ? st : undefined;
};

/** zp: US ZIP, the first five digits only */
export const normalizeZip = (s: string | undefined | null) => {
  const z = (s ?? "").replace(/\D/g, "").slice(0, 5);
  return z.length === 5 ? z : undefined;
};

export const normalizeCountry = (s: string | undefined | null) => {
  const c = lower(s).replace(/[^a-z]/g, "");
  return c.length === 2 ? c : undefined;
};

/** "Jane Q. Public" → first "jane", last "public" */
export function splitName(fullName: string | undefined | null): { first?: string; last?: string } {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { first: parts[0] };
  return { first: parts[0], last: parts[parts.length - 1] };
}

export interface CustomerIdentity {
  email?: string | null;
  phone?: string | null;
  fullName?: string | null;
  city?: string | null;
  state?: string | null;
  zip?: string | null;
  country?: string | null;
  /** A stable id for the customer: their account id, or the order id for guests */
  externalId?: string | null;
}

export interface MetaUserData {
  em?: string[];
  ph?: string[];
  fn?: string[];
  ln?: string[];
  ct?: string[];
  st?: string[];
  zp?: string[];
  country?: string[];
  external_id?: string[];
  client_ip_address?: string;
  client_user_agent?: string;
  fbc?: string;
  fbp?: string;
}

/** Hashes what Meta requires hashed; the browser identifiers go as they are. */
export function buildUserData(identity: CustomerIdentity, attribution: OrderAttribution): MetaUserData {
  const { first, last } = splitName(identity.fullName);
  const country = normalizeCountry(identity.country) ?? "us";
  const one = (hashed: string | undefined) => (hashed ? [hashed] : undefined);
  const data: MetaUserData = {
    em: one(hashOrSkip(normalizeEmail(identity.email))),
    ph: one(hashOrSkip(normalizePhone(identity.phone, country))),
    fn: one(hashOrSkip(normalizeName(first))),
    ln: one(hashOrSkip(normalizeName(last))),
    ct: one(hashOrSkip(normalizeName(identity.city))),
    st: one(hashOrSkip(normalizeState(identity.state))),
    zp: one(hashOrSkip(normalizeZip(identity.zip))),
    country: one(sha256(country)),
    external_id: one(hashOrSkip(identity.externalId?.trim() || undefined)),
    client_ip_address: attribution.clientIp,
    client_user_agent: attribution.userAgent,
    fbc: attribution.fbc,
    fbp: attribution.fbp,
  };
  // Drop the empty keys so the payload only says what it knows
  return Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)) as MetaUserData;
}

/* ---------- events ---------- */

export interface MetaContent {
  id: string;
  quantity: number;
  item_price?: number;
}

export interface MetaCustomData {
  currency: "USD";
  value: number;
  content_type?: "product";
  content_ids?: string[];
  contents?: MetaContent[];
  num_items?: number;
  order_id?: string;
}

export interface MetaServerEvent {
  event_name: "Purchase" | "InitiateCheckout";
  event_id: string;
  /** Unix seconds */
  event_time: number;
  event_source_url: string;
  action_source: "website";
  user_data: MetaUserData;
  custom_data: MetaCustomData;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://kitvoy.com").replace(/\/$/, "");
}

/** An absolute event_source_url from a stored path or URL, on the store's own origin. */
export function toEventSourceUrl(stored: string | undefined, fallbackPath: string): string {
  const base = siteUrl();
  if (stored) {
    try {
      const url = new URL(stored, base);
      if (url.origin === new URL(base).origin) return url.toString();
    } catch {
      // fall through to the default page
    }
  }
  return `${base}${fallbackPath}`;
}

/**
 * POST /{pixel}/events. Resolves true when Meta accepted the event. Never
 * throws; the log line names the event and order, never the customer.
 */
export async function sendMetaEvent(event: MetaServerEvent, label: string): Promise<boolean> {
  const config = getMetaCapiConfig();
  if (!config) return false;

  const body: Record<string, unknown> = { data: [event], access_token: config.accessToken };
  if (config.testEventCode) body.test_event_code = config.testEventCode;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_API_VERSION}/${config.pixelId}/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      // Meta's error message describes the request, not the customer
      console.error(`[meta-capi] ${event.event_name} ${label} rejected (${res.status}): ${text.slice(0, 300)}`);
      return false;
    }
    const json = (await res.json().catch(() => null)) as { events_received?: number } | null;
    console.info(`[meta-capi] ${event.event_name} ${label} sent${config.testEventCode ? ` (test ${config.testEventCode})` : ""}: ${json?.events_received ?? "?"} received`);
    return true;
  } catch (err) {
    console.error(`[meta-capi] ${event.event_name} ${label} failed:`, err instanceof Error ? err.message : err);
    return false;
  } finally {
    clearTimeout(timer);
  }
}

type StoredAddress = { city?: string; state?: string; zip?: string; country?: string };

/** The order's lines as Meta contents, by SKU (falling back to the product id). */
async function orderContents(items: { productId: string | null; quantity: number; unitPrice: number }[]): Promise<MetaContent[]> {
  const ids = items.flatMap((i) => (i.productId ? [i.productId] : []));
  const products = ids.length ? await prisma.product.findMany({ where: { id: { in: ids } }, select: { id: true, sku: true } }) : [];
  const skuOf = new Map(products.map((p) => [p.id, p.sku]));
  return items.map((i) => ({
    id: (i.productId && skuOf.get(i.productId)) || i.productId || "unknown",
    quantity: i.quantity,
    item_price: round2(i.unitPrice),
  }));
}

/**
 * Server-side Purchase for a paid order. Claims the order first
 * (metaPurchaseSentAt), so Stripe retries and the PayPal path can never send
 * two; a failed send releases the claim for the next attempt.
 */
export async function sendPurchaseEvent(orderId: string): Promise<void> {
  if (!getMetaCapiConfig()) return;
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order || order.paymentStatus !== "paid") return;
  const reference = orderReference(order.id);

  // A Stripe test-mode payment is not a sale; it only goes to Test Events, never the live pixel
  if (order.testPayment && !getMetaCapiConfig()?.testEventCode) {
    console.info(`[meta-capi] ${reference} is a test payment; Purchase not sent`);
    return;
  }

  const { count } = await prisma.order.updateMany({
    where: { id: order.id, metaPurchaseSentAt: null },
    data: { metaPurchaseSentAt: new Date() },
  });
  if (count === 0) return; // Already sent

  const attribution = (order.attribution ?? {}) as OrderAttribution;
  const address = (order.shippingAddress ?? {}) as StoredAddress;
  const contents = await orderContents(order.items);
  const event: MetaServerEvent = {
    event_name: "Purchase",
    event_id: reference,
    event_time: Math.floor(Date.now() / 1000),
    event_source_url: toEventSourceUrl(attribution.eventSourceUrl, "/checkout"),
    action_source: "website",
    user_data: buildUserData(
      {
        email: order.email,
        phone: order.phone,
        fullName: order.customerName,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country ?? "US",
        externalId: order.userId ?? order.id,
      },
      attribution,
    ),
    custom_data: {
      currency: "USD",
      value: round2(order.total),
      content_type: "product",
      content_ids: contents.map((c) => c.id),
      contents,
      num_items: contents.reduce((n, c) => n + c.quantity, 0),
      order_id: reference,
    },
  };

  const sent = await sendMetaEvent(event, reference);
  if (!sent) {
    await prisma.order
      .updateMany({ where: { id: order.id, metaPurchaseSentAt: { not: null } }, data: { metaPurchaseSentAt: null } })
      .catch(() => {});
  }
}

/**
 * Server-side InitiateCheckout, sent when the checkout details create the
 * order, with the browser event's id so the two are one to Meta. Skipped when
 * the browser didn't send an id (pixel blocked), since the server copy would
 * then be a second event, not a backup.
 */
export async function sendInitiateCheckoutEvent(orderId: string): Promise<void> {
  if (!getMetaCapiConfig()) return;
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return;
  const attribution = (order.attribution ?? {}) as OrderAttribution;
  const eventId = attribution.initiateCheckoutEventId;
  if (!eventId) return;

  const address = (order.shippingAddress ?? {}) as StoredAddress;
  const contents = await orderContents(order.items);
  const event: MetaServerEvent = {
    event_name: "InitiateCheckout",
    event_id: eventId,
    event_time: Math.floor(order.createdAt.getTime() / 1000),
    event_source_url: toEventSourceUrl(attribution.eventSourceUrl, "/checkout"),
    action_source: "website",
    user_data: buildUserData(
      {
        email: order.email,
        phone: order.phone,
        fullName: order.customerName,
        city: address.city,
        state: address.state,
        zip: address.zip,
        country: address.country ?? "US",
        externalId: order.userId ?? order.id,
      },
      attribution,
    ),
    custom_data: {
      currency: "USD",
      value: round2(order.total),
      content_type: "product",
      content_ids: contents.map((c) => c.id),
      contents,
      num_items: contents.reduce((n, c) => n + c.quantity, 0),
    },
  };
  await sendMetaEvent(event, orderReference(order.id));
}
