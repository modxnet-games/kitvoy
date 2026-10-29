"use server";

import { revalidatePath } from "next/cache";
import {
  upsertHomepageContent,
  type HomepageContent,
} from "@/lib/data/site-content";
import { uploadHomepageImage } from "@/lib/upload";

const STRING_FIELDS: (keyof HomepageContent)[] = [
  "announcementBar",
  "bannerImage",
  "featuredTitle",
  "featuredSubtitle",
  "newsletterTitle",
  "newsletterSubtitle",
];

const BOOLEAN_FIELDS: (keyof HomepageContent)[] = [
  "announcementBarVisible",
  "bannerVisible",
  "featuredProductsVisible",
  "newsletterSectionVisible",
];

export async function saveHomepageContentAction(formData: FormData) {
  const data: Partial<HomepageContent> = {};

  for (const field of STRING_FIELDS) {
    const raw = formData.get(field);
    if (typeof raw === "string") {
      (data as Record<string, unknown>)[field] = raw.trim();
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    (data as Record<string, unknown>)[field] = formData.get(field) === "on";
  }

  await upsertHomepageContent(data);

  revalidatePath("/");
  revalidatePath("/admin/content");

  return { success: true };
}

export async function uploadHomepageImageAction(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file") as File | null;
  if (!file?.size) return { error: "No file provided" };
  return uploadHomepageImage(file);
}
