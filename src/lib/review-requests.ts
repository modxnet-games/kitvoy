import { formatSender } from "@/config/mail-senders";
import { formatOrderReference } from "@/lib/data/admin-orders";
import { prisma } from "@/lib/db";
import { buildReviewRequestEmail, sendReviewRequest, type ReviewRequestPayload } from "@/lib/email";
import { reviewLink } from "@/lib/review-links";
import { REVIEW_REQUEST_DELAY_DAYS, REVIEW_REQUEST_MAX_LATE_DAYS } from "@/lib/reviews";

const DAY_MS = 24 * 60 * 60 * 1000;

export type ReviewRequestResult = { sent: true } | { sent: false; reason: string };

/** The database and mail steps, injectable so the send-once rules can be tested without either. */
export interface ReviewRequestDeps {
  /** Orders delivered within the window that haven't been asked or reviewed yet. */
  dueOrderIds(window: { deliveredFrom: Date; deliveredBy: Date }): Promise<string[]>;
  /** Marks the request as taken; false when it was already taken or the order no longer qualifies. */
  claim(orderId: string): Promise<boolean>;
  /** Gives the claim back after a failed send, so the next run retries it. */
  release(orderId: string): Promise<void>;
  load(orderId: string): Promise<ReviewRequestPayload | null>;
  send(payload: ReviewRequestPayload): Promise<ReviewRequestResult>;
  record(orderId: string, payload: ReviewRequestPayload, result: ReviewRequestResult): Promise<void>;
}

/**
 * Delivered at least REVIEW_REQUEST_DELAY_DAYS ago, and not so long ago that
 * the request is stale (it fell due more than REVIEW_REQUEST_MAX_LATE_DAYS ago).
 */
export function reviewRequestWindow(now: Date) {
  return {
    deliveredBy: new Date(now.getTime() - REVIEW_REQUEST_DELAY_DAYS * DAY_MS),
    deliveredFrom: new Date(now.getTime() - (REVIEW_REQUEST_DELAY_DAYS + REVIEW_REQUEST_MAX_LATE_DAYS) * DAY_MS),
  };
}

/** Sends one order's review request at most once. Never throws. */
export async function deliverReviewRequest(orderId: string, deps: ReviewRequestDeps = prismaReviewDeps): Promise<ReviewRequestResult> {
  let claimed = false;
  try {
    claimed = await deps.claim(orderId);
    if (!claimed) return { sent: false, reason: "Already sent, or the order no longer qualifies" };

    const payload = await deps.load(orderId);
    if (!payload) {
      await deps.release(orderId);
      return { sent: false, reason: "Nothing on this order can be reviewed" };
    }

    const result = await deps.send(payload);
    await deps.record(orderId, payload, result).catch((err) => console.error("[reviews] Couldn't log the review request:", err));
    if (!result.sent) await deps.release(orderId);
    return result;
  } catch (err) {
    console.error("[reviews] Review request error:", err);
    if (claimed) await deps.release(orderId).catch(() => undefined);
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

/** Run daily: emails every order that's due. A failed send is retried on the next run. */
export async function sendDueReviewRequests(now = new Date(), deps: ReviewRequestDeps = prismaReviewDeps) {
  const ids = await deps.dueOrderIds(reviewRequestWindow(now));
  const failed: { orderReference: string; reason: string }[] = [];
  let sent = 0;
  for (const id of ids) {
    const result = await deliverReviewRequest(id, deps);
    if (result.sent) sent++;
    else failed.push({ orderReference: formatOrderReference(id), reason: result.reason });
  }
  return { due: ids.length, sent, failed };
}

const qualifies = { paymentStatus: "paid", status: "DELIVERED", email: { not: null } } as const;

export const prismaReviewDeps: ReviewRequestDeps = {
  async dueOrderIds({ deliveredFrom, deliveredBy }) {
    const orders = await prisma.order.findMany({
      where: {
        ...qualifies,
        reviewRequestSentAt: null,
        deliveredAt: { gte: deliveredFrom, lte: deliveredBy },
        // Already reviewed from the product page: don't ask again
        reviews: { none: {} },
        items: { some: { productId: { not: null } } },
      },
      orderBy: { deliveredAt: "asc" },
      take: 100,
      select: { id: true },
    });
    return orders.map((o) => o.id);
  },
  async claim(orderId) {
    const { count } = await prisma.order.updateMany({
      where: { id: orderId, ...qualifies, reviewRequestSentAt: null },
      data: { reviewRequestSentAt: new Date() },
    });
    return count === 1;
  },
  async release(orderId) {
    await prisma.order.update({ where: { id: orderId }, data: { reviewRequestSentAt: null } });
  },
  async load(orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    const item = order?.items.find((i) => i.productId);
    if (!order?.email || !order.deliveredAt || !item) return null;
    return {
      to: order.email,
      customerName: order.customerName,
      orderReference: formatOrderReference(order.id),
      productName: item.productName,
      deliveredAt: order.deliveredAt,
      reviewUrl: reviewLink(order.id),
    };
  },
  send: sendReviewRequest,
  async record(orderId, payload, result) {
    const { subject, text } = buildReviewRequestEmail(payload);
    await prisma.sentEmail.create({
      data: {
        fromAddress: formatSender("orders"),
        toAddress: payload.to,
        subject,
        body: text,
        status: result.sent ? "sent" : "failed",
        error: result.sent ? null : result.reason.slice(0, 1000),
        orderId,
      },
    });
  },
};
