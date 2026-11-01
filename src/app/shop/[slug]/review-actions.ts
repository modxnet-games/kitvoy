"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getCustomer } from "@/lib/auth/customer-session";
import {
  createReview,
  findPurchaseForReview,
  findReviewByUserAndProduct,
} from "@/lib/data/reviews";
import { isReviewUpload, parseReviewInput } from "@/lib/reviews";
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

  const input = parseReviewInput(formData);
  if (!input.ok) return { success: false, error: input.error };

  const existing = await findReviewByUserAndProduct(customer.userId, productId);
  if (existing) {
    return { success: false, error: "reviews.alreadyReviewed" };
  }

  // Linking the purchase is what earns the "Verified Buyer" badge
  const purchase = await findPurchaseForReview(customer, productId).catch(() => null);
  if (purchase?.reviews.length) {
    return { success: false, error: "reviews.alreadyReviewed" };
  }

  const images = (formData.getAll("imageUrls") as string[]).map((u) => u?.trim()).filter((u) => u && isReviewUpload(u)).slice(0, 4);

  try {
    await createReview({
      userId: customer.userId,
      orderId: purchase?.id ?? null,
      productId,
      authorName: customer.fullName,
      rating: input.rating,
      comment: input.comment,
      images,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { success: false, error: "reviews.alreadyReviewed" };
    }
    const msg = e instanceof Error ? e.message : "";
    const isDataLayer = msg === "Review data layer unavailable";
    return {
      success: false,
      error: isDataLayer ? "reviews.dataLayerUnavailable" : "reviews.submitError",
    };
  }

  // Nothing public changes until an admin approves it
  revalidatePath(`/shop/${productSlug}`);
  revalidatePath("/admin/reviews");
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
