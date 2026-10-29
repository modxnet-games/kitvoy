"use server";

import { revalidatePath } from "next/cache";
import {
  type StoreSocialSettings,
  upsertStoreSettings,
} from "@/lib/data/store-settings";

const STRING_FIELDS: (keyof StoreSocialSettings)[] = [
  "whatsappNumber",
  "whatsappLink",
  "facebookUrl",
  "instagramUrl",
  "tiktokUrl",
  "supportEmail",
  "supportPhone",
];

const BOOLEAN_FIELDS: (keyof StoreSocialSettings)[] = [
  "whatsappEnabled",
  "facebookEnabled",
  "instagramEnabled",
  "tiktokEnabled",
];

export async function saveStoreSettingsAction(formData: FormData) {
  const data: Partial<StoreSocialSettings> = {};

  for (const field of STRING_FIELDS) {
    const raw = formData.get(field);
    if (typeof raw === "string") {
      (data as Record<string, unknown>)[field] = raw.trim();
    }
  }

  for (const field of BOOLEAN_FIELDS) {
    (data as Record<string, unknown>)[field] =
      formData.get(field) === "on";
  }

  await upsertStoreSettings(data);

  // Revalidate layouts that consume these settings
  revalidatePath("/");
  revalidatePath("/admin/settings/store");

  return { success: true };
}

