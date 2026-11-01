"use server";

import { Prisma } from "@prisma/client";
import { createReview, getOrderForReview } from "@/lib/data/reviews";
import { readReviewToken } from "@/lib/review-links";
import { parseReviewInput } from "@/lib/reviews";

export type OrderReviewResult = { success: true } | { success: false; error: string };

/** Saves a review from the emailed link; the signed token stands in for signing in. */
export async function submitOrderReviewAction(token: string, productId: string, formData: FormData): Promise<OrderReviewResult> {
  const orderId = readReviewToken(token);
  if (!orderId) return { success: false, error: "reviews.linkInvalid" };

  const input = parseReviewInput(formData);
  if (!input.ok) return { success: false, error: input.error };

  const order = await getOrderForReview(orderId).catch(() => null);
  if (!order) return { success: false, error: "reviews.linkInvalid" };
  const product = order.products.find((p) => p.productId === productId);
  if (!product) return { success: false, error: "reviews.notInOrder" };
  if (product.reviewed) return { success: false, error: "reviews.alreadyReviewed" };

  try {
    await createReview({
      userId: order.userId,
      orderId: order.id,
      productId,
      authorName: order.customerName,
      rating: input.rating,
      comment: input.comment,
      images: [],
    });
  } catch (e) {
    // Also covers an account that already reviewed this product from another order
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "reviews.alreadyReviewed" };
    }
    console.error("[reviews] Couldn't save an order review:", e);
    return { success: false, error: "reviews.submitError" };
  }

  // No revalidatePath: it would re-render this page and replace the thank-you message
  return { success: true };
}
