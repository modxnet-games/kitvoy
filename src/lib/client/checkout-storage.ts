import { RESUME_FLAG_COOKIE, RESUME_LINK_PARAM, SESSION_TTL_MS, isCheckoutToken } from "@/lib/checkout/resume-constants";

/**
 * What the browser remembers about a checkout, in local storage, for 48 hours:
 *
 * - while the details are being typed and no order exists yet: the draft, so
 *   a reload doesn't wipe the form;
 * - once the order exists: only its session token and KTV reference. The
 *   draft is dropped at that moment; the details then live on the server and
 *   come back only to this token.
 *
 * Everything is cleared the moment the order is paid.
 */
export const CHECKOUT_STORAGE_KEY = "kitvoy-checkout";

const DRAFT_FIELDS = ["email", "fullName", "phone", "address1", "address2", "city", "state", "zip"] as const;
export type CheckoutDraft = Partial<Record<(typeof DRAFT_FIELDS)[number], string>>;

export interface CheckoutRecord {
  v: 1;
  savedAt: number;
  draft?: CheckoutDraft;
  token?: string;
  orderReference?: string;
}

const REFERENCE_RE = /^KTV-[A-Z0-9]{8}$/;

/** Only the fields the form has, as short strings; empty ones are left out. */
export function cleanDraft(input: unknown): CheckoutDraft {
  const out: CheckoutDraft = {};
  if (!input || typeof input !== "object") return out;
  for (const field of DRAFT_FIELDS) {
    const value = (input as Record<string, unknown>)[field];
    if (typeof value === "string" && value.trim() !== "") out[field] = value.slice(0, 200);
  }
  return out;
}

/** A stored record that is still usable, or null (missing, malformed, older than 48 hours). */
export function parseCheckoutRecord(raw: string | null | undefined, now: number = Date.now()): CheckoutRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CheckoutRecord> | null;
    if (!value || value.v !== 1 || typeof value.savedAt !== "number") return null;
    if (now - value.savedAt > SESSION_TTL_MS || value.savedAt > now + 60_000) return null;
    if (isCheckoutToken(value.token) && typeof value.orderReference === "string" && REFERENCE_RE.test(value.orderReference)) {
      // An order exists: nothing but the token and the reference is kept
      return { v: 1, savedAt: value.savedAt, token: value.token, orderReference: value.orderReference };
    }
    const draft = cleanDraft(value.draft);
    return Object.keys(draft).length > 0 ? { v: 1, savedAt: value.savedAt, draft } : null;
  } catch {
    return null;
  }
}

export function readCheckoutRecord(): CheckoutRecord | null {
  try {
    const raw = localStorage.getItem(CHECKOUT_STORAGE_KEY);
    const record = parseCheckoutRecord(raw);
    if (raw && !record) localStorage.removeItem(CHECKOUT_STORAGE_KEY);
    return record;
  } catch {
    return null;
  }
}

function write(record: CheckoutRecord): void {
  try {
    localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Storage unavailable (private mode, quota): the checkout still works, it just can't be resumed from here
  }
}

/** Saves what has been typed so far. Ignored once an order exists: from then on the browser keeps no details. */
export function saveCheckoutDraft(draft: CheckoutDraft): void {
  if (readCheckoutRecord()?.token) return;
  const clean = cleanDraft(draft);
  if (Object.keys(clean).length === 0) return;
  write({ v: 1, savedAt: Date.now(), draft: clean });
}

/** The order exists: keep its token and reference, and drop the draft. */
export function saveCheckoutOrder(token: string, orderReference: string): void {
  if (!isCheckoutToken(token) || !REFERENCE_RE.test(orderReference)) return;
  write({ v: 1, savedAt: Date.now(), token, orderReference });
}

export function clearCheckoutRecord(): void {
  try {
    localStorage.removeItem(CHECKOUT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** True when the server left its checkout cookie on this browser (the token itself is HttpOnly). */
export function hasResumeCookieFlag(): boolean {
  try {
    return document.cookie.split("; ").includes(`${RESUME_FLAG_COOKIE}=1`);
  } catch {
    return false;
  }
}

/** The link token in a URL's query or fragment (`?r=…` or `#r=…`), if it has one. */
export function resumeLinkFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url, "https://kitvoy.com");
    const fromQuery = parsed.searchParams.get(RESUME_LINK_PARAM);
    const fromHash = new URLSearchParams(parsed.hash.replace(/^#/, "")).get(RESUME_LINK_PARAM);
    const token = fromQuery ?? fromHash;
    return isCheckoutToken(token) ? token : null;
  } catch {
    return null;
  }
}

/** Whether the page was opened by PayPal sending the customer back: after approving ("return") or backing out ("cancel"). */
export function paypalReturnFromUrl(url: string): "return" | "cancel" | null {
  try {
    const value = new URL(url, "https://kitvoy.com").searchParams.get("pp");
    return value === "return" || value === "cancel" ? value : null;
  } catch {
    return null;
  }
}

/** What PayPal's return adds to the URL; none of it is needed once the page has read it. */
const PAYPAL_RETURN_PARAMS = ["pp", "token", "PayerID", "ba_token"];

/** The same URL without the link token (and PayPal's return parameters), so it never lingers in the address bar, history or a referrer. */
export function withoutResumeLink(url: string): string {
  try {
    const parsed = new URL(url, "https://kitvoy.com");
    const fromPayPal = parsed.searchParams.has("pp");
    parsed.searchParams.delete(RESUME_LINK_PARAM);
    if (fromPayPal) for (const name of PAYPAL_RETURN_PARAMS) parsed.searchParams.delete(name);
    const hash = new URLSearchParams(parsed.hash.replace(/^#/, ""));
    if (hash.has(RESUME_LINK_PARAM)) {
      hash.delete(RESUME_LINK_PARAM);
      const rest = hash.toString();
      parsed.hash = rest ? `#${rest}` : "";
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return url;
  }
}

/** Removes the link token from the address bar without a navigation. */
export function stripResumeLinkFromAddressBar(): void {
  try {
    const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
    const clean = withoutResumeLink(window.location.href);
    if (clean !== current) window.history.replaceState(window.history.state, "", clean);
  } catch {
    // ignore
  }
}
