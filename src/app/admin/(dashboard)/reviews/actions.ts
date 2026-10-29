"use server";

import { revalidatePath } from "next/cache";
import { toggleReviewVisibility, deleteReview } from "@/lib/data/admin-reviews";

export async function toggleReviewVisibilityAction(
  reviewId: string
): Promise<{ error?: string }> {
  const result = await toggleReviewVisibility(reviewId);
  if (!result.ok) {
    return { error: result.error ?? "Failed to toggle visibility" };
  }
  revalidatePath("/admin/reviews");
  revalidatePath(`/admin/reviews/${reviewId}`);
  revalidatePath("/admin");
  revalidatePath("/shop");
  if (result.productSlug) revalidatePath(`/shop/${result.productSlug}`);
  return {};
}

export async function deleteReviewAction(
  reviewId: string
): Promise<{ error?: string }> {
  const result = await deleteReview(reviewId);
  if (!result.ok) {
    return { error: result.error ?? "Failed to delete review" };
  }
  revalidatePath("/admin/reviews");
  revalidatePath("/admin");
  revalidatePath("/shop");
  if (result.productSlug) revalidatePath(`/shop/${result.productSlug}`);
  return {};
}
