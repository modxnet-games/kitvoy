"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createCategory,
  updateCategory,
  deleteCategory,
  getAdminCategoryById,
  isSlugTaken,
} from "@/lib/data/admin-categories";

function trimSlug(s: string) {
  return s.trim().toLowerCase();
}

export async function createCategoryAction(
  formData: FormData
): Promise<{ error?: string }> {
  const name = (formData.get("name") as string)?.trim() ?? "";
  const slug = trimSlug((formData.get("slug") as string) ?? "");
  const description = (formData.get("description") as string)?.trim() ?? "";

  if (!name) return { error: "Name is required." };
  if (!slug) return { error: "Slug is required." };

  const taken = await isSlugTaken(slug);
  if (taken) return { error: "This slug is already used by another category." };

  const showInMenu = formData.get("showInMenu") === "on";

  await createCategory({
    name,
    slug,
    description: description || null,
    showInMenu,
  });

  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/admin/products/new");
  revalidatePath("/shop");
  revalidatePath("/");
  redirect("/admin/categories");
}

export async function updateCategoryAction(
  formData: FormData
): Promise<{ error?: string }> {
  const categoryId = (formData.get("categoryId") as string)?.trim();
  if (!categoryId) return { error: "Category not found." };

  const existing = await getAdminCategoryById(categoryId);
  if (!existing) return { error: "Category not found." };

  const name = (formData.get("name") as string)?.trim() ?? "";
  const slug = trimSlug((formData.get("slug") as string) ?? "");
  const description = (formData.get("description") as string)?.trim() ?? "";

  if (!name) return { error: "Name is required." };
  if (!slug) return { error: "Slug is required." };

  const taken = await isSlugTaken(slug, categoryId);
  if (taken) return { error: "This slug is already used by another category." };

  const showInMenu = formData.get("showInMenu") === "on";

  await updateCategory(categoryId, {
    name,
    slug,
    description: description || null,
    showInMenu,
  });

  revalidatePath("/admin/categories");
  revalidatePath(`/admin/categories/${categoryId}/edit`);
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/");
  redirect("/admin/categories");
}

export async function deleteCategoryAction(
  categoryId: string
): Promise<{ error?: string }> {
  const result = await deleteCategory(categoryId);
  if (!result.ok) {
    if (result.error === "CATEGORY_IN_USE") {
      return {
        error:
          "Cannot delete this category because it is still used by one or more products. Remove or reassign those products first.",
      };
    }
    return { error: result.error };
  }
  revalidatePath("/admin/categories");
  revalidatePath("/admin/products");
  revalidatePath("/shop");
  revalidatePath("/");
  return {};
}
