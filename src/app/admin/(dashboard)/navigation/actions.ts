"use server";

import { revalidatePath } from "next/cache";
import {
  upsertNavigationItem,
  deleteNavigationItem,
  seedDefaultNavigation,
} from "@/lib/data/navigation";

export async function saveNavigationItemAction(formData: FormData) {
  const id = formData.get("id") as string | null;
  const label = (formData.get("label") as string)?.trim();
  const link = (formData.get("link") as string)?.trim();
  const position = parseInt(formData.get("position") as string, 10) || 0;
  const isVisible = formData.get("isVisible") === "on";

  if (!label || !link) {
    return { success: false, error: "Label and link are required." };
  }

  await upsertNavigationItem({
    id: id && id !== "" ? id : undefined,
    label,
    link,
    position,
    isVisible,
  });

  revalidatePath("/");
  revalidatePath("/admin/navigation");
  return { success: true };
}

export async function deleteNavigationItemAction(id: string) {
  await deleteNavigationItem(id);
  revalidatePath("/");
  revalidatePath("/admin/navigation");
  return { success: true };
}

export async function seedNavigationAction() {
  await seedDefaultNavigation();
  revalidatePath("/");
  revalidatePath("/admin/navigation");
  return { success: true };
}
