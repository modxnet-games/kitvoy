import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { isVerifiedPurchase } from "@/lib/reviews";

function getReviewDelegate() {
  try {
    const d = prisma.review;
    return d && typeof d.findMany === "function" ? d : null;
  } catch {
    return null;
  }
}

/** Recalculates product.rating and product.reviewCount from visible reviews only. */
async function recalculateProductReviewStats(
  tx: Omit<Prisma.TransactionClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">,
  productId: string
) {
  const stats = await tx.review.aggregate({
    where: { productId, isVisible: true },
    _count: true,
    _avg: { rating: true },
  });
  const avgRating = stats._avg.rating ?? 0;
  const reviewCount = stats._count;
  await tx.product.update({
    where: { id: productId },
    data: {
      rating: Math.round(avgRating * 10) / 10,
      reviewCount,
    },
  });
}

/** Pending: new and never moderated. Approved: shown on the storefront. Hidden: taken down by an admin. */
export type ReviewState = "pending" | "approved" | "hidden";

export function reviewState(r: { isVisible: boolean; moderatedAt: Date | null }): ReviewState {
  return r.isVisible ? "approved" : r.moderatedAt ? "hidden" : "pending";
}

export type AdminReviewListItem = {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  isVisible: boolean;
  moderatedAt: Date | null;
  createdAt: Date;
  state: ReviewState;
  /** Kept in this shape for the admin app; guests' reviews use the order's name and email */
  user: { fullName: string; email: string | null };
  /** The order the review is about, when there is one */
  orderId: string | null;
  verified: boolean;
  product: { id: string; name: string; slug: string };
};

export type AdminReviewDetail = AdminReviewListItem;

const adminInclude = {
  user: { select: { fullName: true, email: true } },
  order: { select: { id: true, email: true, customerName: true, paymentStatus: true, status: true } },
  product: { select: { id: true, name: true, slug: true } },
} as const;

type AdminReviewRow = Prisma.ReviewGetPayload<{ include: typeof adminInclude }>;

function toAdminReview(r: AdminReviewRow): AdminReviewListItem {
  return {
    id: r.id,
    rating: r.rating,
    comment: r.comment,
    images: r.images,
    isVisible: r.isVisible,
    moderatedAt: r.moderatedAt,
    createdAt: r.createdAt,
    state: reviewState(r),
    user: {
      fullName: r.authorName ?? r.user?.fullName ?? r.order?.customerName ?? "Customer",
      email: r.user?.email ?? r.order?.email ?? null,
    },
    orderId: r.order?.id ?? null,
    verified: isVerifiedPurchase(r.order),
    product: r.product,
  };
}

export async function getAllAdminReviews(): Promise<AdminReviewListItem[]> {
  const review = getReviewDelegate();
  if (!review) return [];

  try {
    const reviews = await review.findMany({
      include: adminInclude,
      orderBy: { createdAt: "desc" },
    });
    return reviews.map(toAdminReview);
  } catch {
    return [];
  }
}

export async function getAdminReviewById(id: string): Promise<AdminReviewDetail | null> {
  const review = getReviewDelegate();
  if (!review) return null;

  try {
    const r = await review.findUnique({ where: { id }, include: adminInclude });
    return r ? toAdminReview(r) : null;
  } catch {
    return null;
  }
}

export async function toggleReviewVisibility(
  id: string
): Promise<{ ok: boolean; productSlug?: string; error?: string }> {
  const review = getReviewDelegate();
  if (!review) return { ok: false, error: "Review data layer unavailable" };

  try {
    const existing = await review.findUnique({
      where: { id },
      select: {
        productId: true,
        isVisible: true,
        product: { select: { slug: true } },
      },
    });
    if (!existing) return { ok: false, error: "Review not found" };

    const newVisible = !existing.isVisible;

    await prisma.$transaction(async (tx) => {
      await tx.review.update({
        where: { id },
        data: { isVisible: newVisible, moderatedAt: new Date() },
      });
      await recalculateProductReviewStats(tx, existing.productId);
    });

    return { ok: true, productSlug: existing.product.slug };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}

export async function deleteReview(
  id: string
): Promise<{ ok: boolean; productSlug?: string; error?: string }> {
  const review = getReviewDelegate();
  if (!review) return { ok: false, error: "Review data layer unavailable" };

  try {
    const existing = await review.findUnique({
      where: { id },
      select: {
        productId: true,
        product: { select: { slug: true } },
      },
    });
    if (!existing) return { ok: false, error: "Review not found" };

    await prisma.$transaction(async (tx) => {
      await tx.review.delete({ where: { id } });
      await recalculateProductReviewStats(tx, existing.productId);
    });

    return { ok: true, productSlug: existing.product.slug };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return { ok: false, error: msg };
  }
}
