import { prisma } from "@/lib/db";

function getReviewDelegate() {
  try {
    const d = prisma.review;
    return d && typeof d.findMany === "function" ? d : null;
  } catch {
    return null;
  }
}

export type ReviewWithUser = {
  id: string;
  rating: number;
  comment: string;
  images: string[];
  createdAt: Date;
  user: { fullName: string };
};

export async function getReviewsByProductId(
  productId: string
): Promise<ReviewWithUser[]> {
  const review = getReviewDelegate();
  if (!review) return [];

  try {
    const reviews = await review.findMany({
      where: { productId, isVisible: true },
      include: { user: { select: { fullName: true } } },
      orderBy: { createdAt: "desc" },
    });
    return reviews as ReviewWithUser[];
  } catch {
    return [];
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

export async function createReview(data: {
  userId: string;
  productId: string;
  rating: number;
  comment: string;
  images: string[];
}) {
  const review = getReviewDelegate();
  if (!review) throw new Error("Review data layer unavailable");

  const { images, ...rest } = data;
  const cleanImages = images.filter((u): u is string => Boolean(u && typeof u === "string"));

  return prisma.$transaction(async (tx) => {
    const created = await tx.review.create({
      data: { ...rest, images: cleanImages },
    });

    const stats = await tx.review.aggregate({
      where: { productId: data.productId, isVisible: true },
      _count: true,
      _avg: { rating: true },
    });

    const avgRating = stats._avg.rating ?? 0;
    const reviewCount = stats._count;

    await tx.product.update({
      where: { id: data.productId },
      data: {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount,
      },
    });

    return created;
  });
}
