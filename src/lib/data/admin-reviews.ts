import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

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

export type AdminReviewListItem = {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  isVisible: boolean;
  moderatedAt: Date | null;
  createdAt: Date;
  user: { fullName: string };
  product: { id: string; name: string; slug: string };
};

export async function getAllAdminReviews(): Promise<AdminReviewListItem[]> {
  const review = getReviewDelegate();
  if (!review) return [];

  try {
    const reviews = await review.findMany({
      include: {
        user: { select: { fullName: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return reviews as AdminReviewListItem[];
  } catch {
    return [];
  }
}

export type AdminReviewDetail = Omit<AdminReviewListItem, "user"> & {
  user: { fullName: string; email: string };
};

export async function getAdminReviewById(id: string): Promise<AdminReviewDetail | null> {
  const review = getReviewDelegate();
  if (!review) return null;

  try {
    const r = await review.findUnique({
      where: { id },
      include: {
        user: { select: { fullName: true, email: true } },
        product: { select: { id: true, name: true, slug: true } },
      },
    });
    return r as AdminReviewDetail | null;
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
