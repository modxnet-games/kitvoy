import { STORE_TIME_ZONE } from "@/lib/formatters";

/** Days after delivery before the review request goes out, so the customer has had time to use it. */
export const REVIEW_REQUEST_DELAY_DAYS = 4;
/** A request still unsent this many days after it fell due is dropped (e.g. orders delivered before this existed). */
export const REVIEW_REQUEST_MAX_LATE_DAYS = 30;
/** Reviews the landing page shows before "Show more"; the Product structured data lists the same ones. */
export const REVIEWS_SHOWN_FIRST = 6;
/** Most recent approved reviews loaded for the landing page. */
export const REVIEWS_LOADED = 30;
export const REVIEW_COMMENT_MAX = 2000;

/** An approved review as the storefront and the structured data show it. */
export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  /** "Sam L." */
  author: string;
  verified: boolean;
  /** ISO timestamp */
  createdAt: string;
  /** YYYY-MM-DD in the store's time zone, matching the date shown on the page */
  publishedOn: string;
}

export interface ReviewSummary {
  count: number;
  /** Mean of all approved ratings, to one decimal */
  average: number;
  /** Approved reviews per star, index 0 = 5 stars … index 4 = 1 star */
  distribution: number[];
  /** Newest first, at most REVIEWS_LOADED */
  reviews: PublicReview[];
}

/** First name and last initial ("Sam L."), so a full name is never published. */
export function reviewerName(fullName: string | null | undefined): string {
  const parts = (fullName ?? "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "Kitvoy customer";
  const first = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
  if (parts.length === 1) return first;
  return `${first} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

/**
 * A review earns "Verified Buyer" when it's linked to an order that was paid
 * for and not canceled. A later refund doesn't undo the purchase, and dropping
 * the badge then would only ever hit unhappy customers' reviews.
 */
export function isVerifiedPurchase(order: { paymentStatus: string; status: string } | null | undefined): boolean {
  return !!order && order.status !== "CANCELED" && (order.paymentStatus === "paid" || order.paymentStatus === "refunded");
}

/** Count, one-decimal average and per-star counts from grouped ratings. */
export function summarizeRatings(groups: { rating: number; count: number }[]): Omit<ReviewSummary, "reviews"> {
  const distribution = [5, 4, 3, 2, 1].map((star) => groups.filter((g) => g.rating === star).reduce((n, g) => n + g.count, 0));
  const count = distribution.reduce((n, c) => n + c, 0);
  const total = distribution.reduce((sum, c, i) => sum + c * (5 - i), 0);
  return { count, average: count ? Math.round((total / count) * 10) / 10 : 0, distribution };
}

/** YYYY-MM-DD in the store's time zone. */
export function storeDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: STORE_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

export type ReviewInputError = "reviews.ratingRequired" | "reviews.commentRequired" | "reviews.commentTooLong";

/** Star rating 1–5 and a non-empty comment of at most REVIEW_COMMENT_MAX characters. */
export function parseReviewInput(formData: FormData): { ok: true; rating: number; comment: string } | { ok: false; error: ReviewInputError } {
  const rating = Number(formData.get("rating"));
  const comment = String(formData.get("comment") ?? "").replace(/\r\n?/g, "\n").trim();
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return { ok: false, error: "reviews.ratingRequired" };
  if (!comment) return { ok: false, error: "reviews.commentRequired" };
  if (comment.length > REVIEW_COMMENT_MAX) return { ok: false, error: "reviews.commentTooLong" };
  return { ok: true, rating, comment };
}

/** Review photos must be files uploaded to this store, never arbitrary URLs. */
export function isReviewUpload(url: string): boolean {
  return /^\/uploads\/reviews\/[\w./-]+$/.test(url) && !url.includes("..");
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** One line for the admin order page about this order's review request, or null before delivery. */
export function reviewRequestStatus(
  o: { deliveredAt: Date | null; reviewRequestSentAt: Date | null; hasReview: boolean; hasEmail: boolean },
  now = new Date(),
): string | null {
  const day = (d: Date) => d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: STORE_TIME_ZONE });
  if (o.reviewRequestSentAt) return `Review request emailed ${day(o.reviewRequestSentAt)}`;
  if (o.hasReview) return "The customer has already reviewed this order";
  if (!o.deliveredAt) return null;
  if (!o.hasEmail) return "No review request: this order has no email";
  const due = new Date(o.deliveredAt.getTime() + REVIEW_REQUEST_DELAY_DAYS * DAY_MS);
  if (now.getTime() > due.getTime() + REVIEW_REQUEST_MAX_LATE_DAYS * DAY_MS) return "No review request: delivered too long ago";
  if (now < due) return `Review request will be emailed on ${day(due)}`;
  return "Review request goes out with the next daily run";
}

/**
 * Whether the buyer can review this order from their account: "open" once a
 * paid order is delivered, "done" when every product in it has a review, and
 * null otherwise (not delivered yet, unpaid or canceled).
 */
export function orderReviewState(o: {
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  items: { productId: string | null }[];
  reviews: { productId: string }[];
}): "open" | "done" | null {
  if (!isVerifiedPurchase(o)) return null;
  if (o.status !== "DELIVERED" && o.fulfillmentStatus !== "DELIVERED") return null;
  const products = new Set(o.items.flatMap((i) => (i.productId ? [i.productId] : [])));
  if (products.size === 0) return null;
  const reviewed = new Set(o.reviews.map((r) => r.productId));
  return [...products].every((p) => reviewed.has(p)) ? "done" : "open";
}
