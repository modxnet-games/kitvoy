/**
 * What the browser remembers about a checkout, in local storage, for 48 hours:
 * the details typed so far, so a reload doesn't wipe the form. It is cleared
 * the moment the order is placed.
 */
export const CHECKOUT_STORAGE_KEY = "kitvoy-checkout";

const DRAFT_TTL_MS = 48 * 60 * 60 * 1000;

const DRAFT_FIELDS = ["email", "fullName", "phone", "address1", "address2", "city", "state", "zip", "country"] as const;
export type CheckoutDraft = Partial<Record<(typeof DRAFT_FIELDS)[number], string>>;

export interface CheckoutRecord {
  v: 1;
  savedAt: number;
  draft: CheckoutDraft;
}

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

/** A stored record that is still usable, or null (missing, malformed, without a draft, older than 48 hours). */
export function parseCheckoutRecord(raw: string | null | undefined, now: number = Date.now()): CheckoutRecord | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<CheckoutRecord> | null;
    if (!value || value.v !== 1 || typeof value.savedAt !== "number") return null;
    if (now - value.savedAt > DRAFT_TTL_MS || value.savedAt > now + 60_000) return null;
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

/** Saves what has been typed so far. */
export function saveCheckoutDraft(draft: CheckoutDraft): void {
  const clean = cleanDraft(draft);
  if (Object.keys(clean).length === 0) return;
  try {
    localStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify({ v: 1, savedAt: Date.now(), draft: clean } satisfies CheckoutRecord));
  } catch {
    // Storage unavailable (private mode, quota): the checkout still works, the form just starts empty after a reload
  }
}

export function clearCheckoutRecord(): void {
  try {
    localStorage.removeItem(CHECKOUT_STORAGE_KEY);
  } catch {
    // ignore
  }
}
