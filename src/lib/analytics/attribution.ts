/**
 * Ad attribution captured on landing and carried to the order: UTM
 * parameters, Meta's click id (fbclid → _fbc) and browser id (_fbp). Shared
 * by the middleware (writes the cookie) and the order API (reads it).
 */

export const ATTRIBUTION_COOKIE = "kv_attr";
export const ATTRIBUTION_MAX_AGE = 30 * 24 * 60 * 60; // 30 days, in seconds
export const FBC_MAX_AGE = 90 * 24 * 60 * 60;

export const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
export type UtmKey = (typeof UTM_KEYS)[number];

export interface LandingAttribution extends Partial<Record<UtmKey, string>> {
  fbclid?: string;
  /** When fbclid was seen (ms), for building _fbc if the pixel never set it */
  fbclidAt?: number;
  /** The first page of the visit (path + query), for event_source_url */
  landing?: string;
  at?: number;
}

/** What the order stores for the Conversions API; no personal data beyond what the order already has. */
export interface OrderAttribution extends Partial<Record<UtmKey, string>> {
  fbclid?: string;
  fbp?: string;
  fbc?: string;
  clientIp?: string;
  userAgent?: string;
  landing?: string;
  /** The checkout page the browser's InitiateCheckout was sent from */
  eventSourceUrl?: string;
  /** The browser's InitiateCheckout event_id, reused by the server event */
  initiateCheckoutEventId?: string;
}

const clean = (v: string | null | undefined, max = 200) => {
  const s = (v ?? "").trim().replace(/[\u0000-\u001f\u007f]/g, "");
  return s ? s.slice(0, max) : undefined;
};

/** Picks the ad parameters out of a landing URL; undefined when there are none. */
export function attributionFromUrl(url: URL, now = Date.now()): LandingAttribution | null {
  const out: LandingAttribution = {};
  let found = false;
  for (const key of UTM_KEYS) {
    const value = clean(url.searchParams.get(key));
    if (value) {
      out[key] = value;
      found = true;
    }
  }
  const fbclid = clean(url.searchParams.get("fbclid"), 500);
  if (fbclid && /^[A-Za-z0-9_-]+$/.test(fbclid)) {
    out.fbclid = fbclid;
    out.fbclidAt = now;
    found = true;
  }
  if (!found) return null;
  out.landing = clean(url.pathname + url.search, 500);
  out.at = now;
  return out;
}

/** The cookie's value: JSON, which the cookie layer URL-encodes on the way out and decodes on the way in. */
export function serializeAttribution(a: LandingAttribution): string {
  return JSON.stringify(a);
}

export function parseAttribution(raw: string | undefined | null): LandingAttribution | null {
  if (!raw) return null;
  try {
    const text = raw.startsWith("{") ? raw : decodeURIComponent(raw);
    const parsed = JSON.parse(text) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return null;
    const out: LandingAttribution = {};
    for (const key of UTM_KEYS) {
      const v = clean(typeof parsed[key] === "string" ? (parsed[key] as string) : undefined);
      if (v) out[key] = v;
    }
    if (typeof parsed.fbclid === "string" && /^[A-Za-z0-9_-]{1,500}$/.test(parsed.fbclid)) out.fbclid = parsed.fbclid;
    if (typeof parsed.fbclidAt === "number" && Number.isFinite(parsed.fbclidAt)) out.fbclidAt = parsed.fbclidAt;
    if (typeof parsed.landing === "string") out.landing = clean(parsed.landing, 500);
    if (typeof parsed.at === "number") out.at = parsed.at;
    return out;
  } catch {
    return null;
  }
}

/**
 * Meta's _fbc format: fb.{subdomainIndex}.{creationTime}.{fbclid}. Index 1 is
 * the registrable domain (kitvoy.com), which is where the pixel sets its own.
 */
export function buildFbc(fbclid: string, createdAtMs: number): string {
  return `fb.1.${Math.floor(createdAtMs)}.${fbclid}`;
}

const FBP_RE = /^fb\.\d\.\d+\.\d+$/;
const FBC_RE = /^fb\.\d\.\d+\.[A-Za-z0-9_-]+$/;

/** The visitor's Meta cookies, only when they have the shape Meta sets. */
export function validFbp(value: string | undefined | null): string | undefined {
  return value && FBP_RE.test(value) ? value : undefined;
}
export function validFbc(value: string | undefined | null): string | undefined {
  return value && FBC_RE.test(value) && value.length <= 600 ? value : undefined;
}

type CookieReader = { get(name: string): { value: string } | undefined };

/**
 * Everything the order needs for ad attribution and the Conversions API,
 * read from the request's cookies and headers. The IP comes from Cloudflare's
 * header first (the store sits behind it), then the proxy chain.
 */
export function readOrderAttribution(cookies: CookieReader, headers: Headers): OrderAttribution {
  const out: OrderAttribution = {};
  const landing = parseAttribution(cookies.get(ATTRIBUTION_COOKIE)?.value);
  if (landing) {
    for (const key of UTM_KEYS) if (landing[key]) out[key] = landing[key];
    if (landing.fbclid) out.fbclid = landing.fbclid;
    if (landing.landing) out.landing = landing.landing;
  }

  const fbp = validFbp(cookies.get("_fbp")?.value);
  if (fbp) out.fbp = fbp;
  const fbc = validFbc(cookies.get("_fbc")?.value) ?? (landing?.fbclid ? buildFbc(landing.fbclid, landing.fbclidAt ?? Date.now()) : undefined);
  if (fbc) out.fbc = fbc;

  const ip = clean(headers.get("cf-connecting-ip") ?? headers.get("x-real-ip") ?? headers.get("x-forwarded-for")?.split(",")[0], 64);
  if (ip) out.clientIp = ip;
  const ua = clean(headers.get("user-agent"), 512);
  if (ua) out.userAgent = ua;
  return out;
}
