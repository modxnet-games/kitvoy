"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  createProduct,
  updateProduct,
  deleteProduct,
  getAdminProductById,
} from "@/lib/data/admin-products";
import { findOrCreateCategoryByName } from "@/lib/data/admin-categories";
import { uploadProductImage, deleteMultipleFromStorage } from "@/lib/upload";

const BADGE_OPTIONS = ["New", "Sale", "Bestseller"] as const;

function parseFloatSafe(val: string | null): number | null {
  if (val === null || val === undefined || val === "") return null;
  const n = parseFloat(val);
  return Number.isNaN(n) ? null : n;
}

function parseProductFormData(formData: FormData) {
  const name = (formData.get("name") as string)?.trim() ?? "";
  const slug = (formData.get("slug") as string)?.trim() ?? "";
  const shortDescription = (formData.get("shortDescription") as string)?.trim() ?? "";
  const description = (formData.get("description") as string)?.trim() ?? "";
  const details = (formData.get("details") as string)?.trim() ?? "";
  const price = parseFloat(formData.get("price") as string) || 0;
  const shippingTax = parseFloat(formData.get("shippingTax") as string) || 0;
  const compareAtPrice = parseFloatSafe(formData.get("compareAtPrice") as string | null);
  const badgeRaw = (formData.get("badge") as string)?.trim() || null;
  const badge = badgeRaw && BADGE_OPTIONS.includes(badgeRaw as (typeof BADGE_OPTIONS)[number])
    ? badgeRaw
    : null;
  const rating = parseFloat(formData.get("rating") as string) || 0;
  const reviewCount = parseInt(formData.get("reviewCount") as string, 10) || 0;
  const stock = parseInt(formData.get("stock") as string, 10) ?? 0;
  const sku = (formData.get("sku") as string)?.trim() ?? "";
  const isFeatured = formData.get("isFeatured") === "on";
  const categoryId = (formData.get("categoryId") as string)?.trim() ?? "";
  const categoryNameNew = (formData.get("categoryNameNew") as string)?.trim() ?? "";

  const imageUrls: string[] = [];
  const rawUrls = formData.getAll("imageUrls") as string[];
  for (const u of rawUrls) {
    const url = u?.trim();
    if (url) imageUrls.push(url);
  }

  return {
    name,
    slug,
    shortDescription,
    description,
    details,
    price,
    shippingTax,
    compareAtPrice,
    badge,
    rating,
    reviewCount,
    stock,
    sku,
    isFeatured,
    categoryId,
    categoryNameNew,
    imageUrls: imageUrls.length > 0 ? imageUrls : [""],
  };
}

function validateProduct(data: ReturnType<typeof parseProductFormData>): string[] {
  const errors: string[] = [];
  if (!data.name) errors.push("Name is required");
  if (!data.slug) errors.push("Slug is required");
  if (!data.shortDescription) errors.push("Short description is required");
  if (!data.description) errors.push("Description is required");
  if (!data.details) errors.push("Details are required");
  if (data.price < 0) errors.push("Price must be 0 or greater");
  if (data.shippingTax < 0) errors.push("Shipping tax must be 0 or greater");
  if (data.compareAtPrice !== null && data.compareAtPrice < 0)
    errors.push("Compare at price must be 0 or greater");
  if (data.rating < 0 || data.rating > 5) errors.push("Rating must be between 0 and 5");
  if (data.reviewCount < 0) errors.push("Review count must be 0 or greater");
  if (data.stock < 0) errors.push("Stock must be 0 or greater");
  if (!data.sku) errors.push("SKU is required");
  const hasCategory = data.categoryId || data.categoryNameNew;
  if (!hasCategory) errors.push("Category is required: select one or type a new category name");
  return errors;
}

export type CreateProductState = { error?: string; fieldErrors?: Record<string, string> };

export async function createProductAction(
  _prev: CreateProductState,
  formData: FormData
): Promise<CreateProductState> {
  const data = parseProductFormData(formData);
  const errors = validateProduct(data);
  if (errors.length > 0) {
    return { error: errors.join(". ") };
  }

  let categoryId = data.categoryId;
  if (data.categoryNameNew) {
    try {
      const resolved = await findOrCreateCategoryByName(data.categoryNameNew);
      categoryId = resolved.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to resolve category";
      return { error: msg };
    }
  }

  const { categoryNameNew: _n, ...rest } = data;
  try {
    await createProduct({
      ...rest,
      categoryId,
      compareAtPrice: data.compareAtPrice ?? null,
      badge: data.badge ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create product";
    return { error: msg };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/shop");
  revalidatePath("/");
  redirect("/admin/products");
}

export type UpdateProductState = { error?: string };

export async function updateProductAction(
  productId: string,
  _prev: UpdateProductState,
  formData: FormData
): Promise<UpdateProductState> {
  const data = parseProductFormData(formData);
  const errors = validateProduct(data);
  if (errors.length > 0) {
    return { error: errors.join(". ") };
  }

  const existing = await getAdminProductById(productId);
  if (!existing) {
    return { error: "Product not found" };
  }

  let categoryId = data.categoryId;
  if (data.categoryNameNew) {
    try {
      const resolved = await findOrCreateCategoryByName(data.categoryNameNew);
      categoryId = resolved.id;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to resolve category";
      return { error: msg };
    }
  }

  const { categoryNameNew: _n2, ...rest } = data;
  try {
    await updateProduct(productId, {
      ...rest,
      categoryId,
      compareAtPrice: data.compareAtPrice ?? null,
      badge: data.badge ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update product";
    return { error: msg };
  }

  revalidatePath("/admin/products");
  revalidatePath(`/admin/products/${productId}/edit`);
  revalidatePath("/admin");
  revalidatePath("/shop");
  revalidatePath("/");
  revalidatePath(`/shop/${existing.slug}`);
  redirect("/admin/products");
}

/** Server action for create form - pass directly to Client Component */
export async function createProductFormAction(
  formData: FormData
): Promise<{ error?: string }> {
  return createProductAction({}, formData);
}

/** Server action for edit form - reads productId from formData */
export async function updateProductFormAction(
  formData: FormData
): Promise<{ error?: string }> {
  const productId = (formData.get("productId") as string)?.trim();
  if (!productId) return { error: "Product ID required" };
  return updateProductAction(productId, {}, formData);
}

/** Server action for product image upload - pass to Client Component */
export async function uploadProductImageAction(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const file = formData.get("file") as File | null;
  if (!file?.size) return { error: "No file provided" };
  return uploadProductImage(file);
}

export async function deleteProductAction(productId: string): Promise<{ error?: string }> {
  try {
    // Fetch product images before deletion so we can clean up storage
    const existing = await getAdminProductById(productId);
    if (existing) {
      const imageUrls = existing.images.map((i: { url: string }) => i.url);
      await deleteMultipleFromStorage(imageUrls);
    }

    await deleteProduct(productId);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete product";
    return { error: msg };
  }

  revalidatePath("/admin/products");
  revalidatePath("/admin");
  revalidatePath("/shop");
  revalidatePath("/");
  return {};
}
