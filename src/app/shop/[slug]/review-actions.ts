"use server";

import { revalidatePath } from "next/cache";
import { getCustomer } from "@/lib/auth/customer-session";
import {
  createReview,
  findReviewByUserAndProduct,
} from "@/lib/data/reviews";
import { uploadReviewImage } from "@/lib/upload";

export type SubmitReviewResult =
  | { success: true }
  | { success: false; error: string };

export async function submitReviewAction(
  productId: string,
  productSlug: string,
  formData: FormData
): Promise<SubmitReviewResult> {
  const customer = await getCustomer();
  if (!customer) {
    return { success: false, error: "reviews.loginRequired" };
  }

  const ratingRaw = formData.get("rating");
  const rating = ratingRaw ? parseInt(String(ratingRaw), 10) : 0;
  const comment = (formData.get("comment") as string)?.trim() ?? "";

  if (rating < 1 || rating > 5) {
    return { success: false, error: "reviews.ratingRequired" };
  }
  if (!comment) {
    return { success: false, error: "reviews.commentRequired" };
  }

  const existing = await findReviewByUserAndProduct(customer.userId, productId);
  if (existing) {
    return { success: false, error: "reviews.alreadyReviewed" };
  }

  const imageUrls: string[] = [];
  const rawUrls = formData.getAll("imageUrls") as string[];
  for (const u of rawUrls) {
    const url = u?.trim();
    if (url) imageUrls.push(url);
  }

  try {
    await createReview({
      userId: customer.userId,
      productId,
      rating,
      comment,
      images: imageUrls,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    const isDataLayer = msg === "Review data layer unavailable";
    return {
      success: false,
      error: isDataLayer ? "reviews.dataLayerUnavailable" : "reviews.submitError",
    };
  }

  revalidatePath(`/shop/${productSlug}`);
  revalidatePath("/shop");
  revalidatePath("/");
  return { success: true };
}

export async function uploadReviewImageAction(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const customer = await getCustomer();
  if (!customer) {
    return { error: "reviews.loginRequired" };
  }

  const file = formData.get("file") as File | null;
  if (!file?.size) return { error: "No file provided" };
  return uploadReviewImage(file);
}
