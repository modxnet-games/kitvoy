import { prisma } from "@/lib/db";
import {
  isVerifiedPurchase,
  REVIEWS_LOADED,
  reviewerName,
  storeDate,
  summarizeRatings,
  type PublicReview,
  type ReviewSummary,
} from "@/lib/reviews";

function getReviewDelegate() {
  try {
    const d = prisma.review;
    return d && typeof d.findMany === "function" ? d : null;
  } catch {
    return null;
  }
}

/** Approved reviews only: new reviews wait for an admin (isVisible starts false). */
const APPROVED = { isVisible: true } as const;

const publicSelect = {
  id: true,
  rating: true,
  comment: true,
  images: true,
  authorName: true,
  createdAt: true,
  user: { select: { fullName: true } },
  order: { select: { paymentStatus: true, status: true } },
} as const;

function toPublicReview(r: {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  authorName: string | null;
  createdAt: Date;
  user: { fullName: string } | null;
  order: { paymentStatus: string; status: string } | null;
}): PublicReview {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    images: r.images,
    author: reviewerName(r.authorName ?? r.user?.fullName),
    verified: isVerifiedPurchase(r.order),
    createdAt: r.createdAt.toISOString(),
    publishedOn: storeDate(r.createdAt),
  };
}

export async function getReviewsByProductId(productId: string): Promise<PublicReview[]> {
  const review = getReviewDelegate();
  if (!review) return [];

  try {
    const reviews = await review.findMany({
      where: { productId, ...APPROVED },
      select: publicSelect,
      orderBy: { createdAt: "desc" },
    });
    return reviews.map(toPublicReview);
  } catch {
    return [];
  }
}

/**
 * Count, average and star breakdown over every approved review, plus the newest
 * ones to show. Null when there are none, so nothing about ratings is rendered.
 */
export async function getProductReviewSummary(productId: string): Promise<ReviewSummary | null> {
  const review = getReviewDelegate();
  if (!review) return null;

  try {
    const [groups, latest] = await Promise.all([
      review.groupBy({ by: ["rating"], where: { productId, ...APPROVED }, _count: { _all: true } }),
      review.findMany({ where: { productId, ...APPROVED }, select: publicSelect, orderBy: { createdAt: "desc" }, take: REVIEWS_LOADED }),
    ]);
    const stats = summarizeRatings(groups.map((g) => ({ rating: g.rating, count: g._count._all })));
    if (stats.count === 0) return null;
    return { ...stats, reviews: latest.map(toPublicReview) };
  } catch (err) {
    console.error("[reviews] Couldn't load the review summary:", err);
    return null;
  }
}

export async function findReviewByUserAndProduct(
  userId: string,
  productId: string
) {
  const review = getReviewDelegate();
  if (!review) return null;

  try {
    return review.findUnique({
      where: {
        userId_productId: { userId, productId },
      },
    });
  } catch {
    return null;
  }
}

/**
 * The customer's most recent paid order that contains this product, matched by
 * account or by the email they checked out with as a guest.
 */
export async function findPurchaseForReview(customer: { userId: string; email: string }, productId: string) {
  return prisma.order.findFirst({
    where: {
      paymentStatus: { in: ["paid", "refunded"] },
      status: { not: "CANCELED" },
      items: { some: { productId } },
      OR: [{ userId: customer.userId }, { email: { equals: customer.email, mode: "insensitive" } }],
    },
    orderBy: { createdAt: "desc" },
    select: { id: true, reviews: { where: { productId }, select: { id: true } } },
  });
}

/** Saves a review for moderation; it stays off the storefront until an admin approves it. */
export async function createReview(data: {
  userId?: string | null;
  orderId?: string | null;
  productId: string;
  authorName: string;
  rating: number;
  comment: string;
  images: string[];
}) {
  const review = getReviewDelegate();
  if (!review) throw new Error("Review data layer unavailable");

  const cleanImages = data.images.filter((u): u is string => Boolean(u && typeof u === "string"));
  return review.create({
    data: { ...data, images: cleanImages, isVisible: false },
  });
}

/** A paid order the emailed review link points to, with what can still be reviewed. */
export async function getOrderForReview(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      customerName: true,
      paymentStatus: true,
      status: true,
      userId: true,
      items: { select: { productId: true, productName: true } },
      reviews: { select: { productId: true } },
    },
  });
  if (!order || !isVerifiedPurchase(order)) return null;

  const reviewed = new Set(order.reviews.map((r) => r.productId));
  const products = new Map<string, { productId: string; productName: string; reviewed: boolean }>();
  for (const item of order.items) {
    if (item.productId && !products.has(item.productId)) {
      products.set(item.productId, { productId: item.productId, productName: item.productName, reviewed: reviewed.has(item.productId) });
    }
  }
  return { id: order.id, customerName: order.customerName, userId: order.userId, products: [...products.values()] };
}
