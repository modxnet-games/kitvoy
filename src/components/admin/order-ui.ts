import type { CodStatus } from "@/lib/data/admin-orders";

/*
 * How orders read in the dashboard: the names of the statuses, the one-tap
 * buttons of an order, the links to the filtered list. Plain data with no
 * server imports, so client components can use it (the data layer talks to the
 * database and cannot be imported in the browser; only its types are used here).
 */

/** The statuses in the order an order usually goes through them. */
export const STATUS_LABELS: Record<CodStatus, string> = {
  PENDING: "New",
  NO_ANSWER: "No answer",
  CONFIRMED: "Confirmed",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  RETURNED: "Returned",
  CANCELED: "Canceled",
};

export const STATUS_LIST = Object.keys(STATUS_LABELS) as CodStatus[];

/** The name of a status; one the dashboard doesn't know (a row of the old store) is shown as it is stored. */
export function statusLabel(status: string): string {
  return Object.hasOwn(STATUS_LABELS, status) ? STATUS_LABELS[status as CodStatus] : status;
}

export interface NextStep {
  status: CodStatus;
  label: string;
  /** primary: the usual next step. success: the cash is collected. neutral: try again later. danger: the sale is lost. */
  tone: "primary" | "success" | "neutral" | "danger";
}

/**
 * What usually happens next to an order, as one-tap buttons. Anything else (a
 * correction, an order brought back) goes through "Change status".
 */
export const NEXT_STEPS: Record<CodStatus, NextStep[]> = {
  PENDING: [
    { status: "CONFIRMED", label: "Confirmed", tone: "primary" },
    { status: "NO_ANSWER", label: "No answer", tone: "neutral" },
    { status: "CANCELED", label: "Cancel", tone: "danger" },
  ],
  NO_ANSWER: [
    { status: "CONFIRMED", label: "Confirmed", tone: "primary" },
    { status: "CANCELED", label: "Cancel", tone: "danger" },
  ],
  CONFIRMED: [
    { status: "SHIPPED", label: "Shipped", tone: "primary" },
    { status: "CANCELED", label: "Cancel", tone: "danger" },
  ],
  SHIPPED: [
    { status: "DELIVERED", label: "Delivered", tone: "success" },
    { status: "RETURNED", label: "Returned", tone: "danger" },
  ],
  DELIVERED: [],
  RETURNED: [],
  CANCELED: [],
};

/** Customers to phone: new orders, and those who did not pick up. */
export const TO_CALL: CodStatus[] = ["PENDING", "NO_ANSWER"];
/** Customers who said yes on the phone, whatever happened to the parcel afterwards. */
export const CONFIRMED_OR_LATER: CodStatus[] = ["CONFIRMED", "SHIPPED", "DELIVERED", "RETURNED"];
/** Parcels that reached an end: handed over, or sent back. */
export const DELIVERED_OR_RETURNED: CodStatus[] = ["DELIVERED", "RETURNED"];

/** The orders list, filtered: /admin/orders?status=PENDING,NO_ANSWER&q=… */
export function ordersHref(filter: { status?: readonly CodStatus[]; q?: string; show?: number } = {}): string {
  const parts: string[] = [];
  // Statuses are plain capitals and underscores: they need no encoding, and the commas stay readable
  if (filter.status?.length) parts.push(`status=${filter.status.join(",")}`);
  if (filter.q) parts.push(`q=${encodeURIComponent(filter.q)}`);
  if (filter.show) parts.push(`show=${filter.show}`);
  return parts.length > 0 ? `/admin/orders?${parts.join("&")}` : "/admin/orders";
}

/** "2 × Sanadi (Noir, XL), 1 × Sanadi (Beige, M)" */
export function itemsSummary(items: { quantity: number; productName: string }[]): string {
  return items.map((item) => `${item.quantity} × ${item.productName}`).join(", ");
}

/** A share between 0 and 1 as "67%"; a dash when there is nothing to measure yet. */
export function formatRate(rate: number | null): string {
  return rate === null ? "—" : `${Math.round(rate * 100)}%`;
}

/**
 * A server action that redirects (the session ran out, the order was deleted)
 * rejects with Next's redirect error while the router is already on its way:
 * that is not a failure to show.
 */
export function isRedirectError(error: unknown): boolean {
  const digest = (error as { digest?: unknown } | null)?.digest;
  return typeof digest === "string" && digest.startsWith("NEXT_REDIRECT");
}
