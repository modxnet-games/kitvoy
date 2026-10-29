import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import {
  getAdminProductById,
  updateProduct,
  deleteProduct,
} from "@/lib/data/admin-products";
import { findOrCreateCategoryByName } from "@/lib/data/admin-categories";
import { deleteMultipleFromStorage } from "@/lib/upload";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const product = await getAdminProductById(id);
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }
    return NextResponse.json(product);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch product" },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await getAdminProductById(id);
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const {
      name, slug, shortDescription, description, details,
      price, shippingTax, compareAtPrice, badge,
      rating, reviewCount, stock, sku, isFeatured,
      categoryId, categoryNameNew, imageUrls,
    } = body;

    let resolvedCategoryId = categoryId;
    if (categoryNameNew) {
      const resolved = await findOrCreateCategoryByName(categoryNameNew);
      resolvedCategoryId = resolved.id;
    }

    const product = await updateProduct(id, {
      name: (name ?? existing.name).trim(),
      slug: (slug ?? existing.slug).trim(),
      shortDescription: (shortDescription ?? existing.shortDescription).trim(),
      description: (description ?? existing.description).trim(),
      details: (details ?? existing.details).trim(),
      price: price != null ? parseFloat(price) : existing.price,
      shippingTax: shippingTax != null ? parseFloat(shippingTax) : existing.shippingTax,
      compareAtPrice: compareAtPrice !== undefined
        ? (compareAtPrice != null ? parseFloat(compareAtPrice) : null)
        : existing.compareAtPrice,
      badge: badge !== undefined ? (badge || null) : existing.badge,
      rating: rating != null ? parseFloat(rating) : existing.rating,
      reviewCount: reviewCount != null ? parseInt(reviewCount, 10) : existing.reviewCount,
      stock: stock != null ? parseInt(stock, 10) : existing.stock,
      sku: (sku ?? existing.sku).trim(),
      isFeatured: isFeatured !== undefined ? !!isFeatured : existing.isFeatured,
      categoryId: resolvedCategoryId || existing.categoryId,
      imageUrls: imageUrls || existing.images.map((i: { url: string }) => i.url),
    });

    return NextResponse.json(product);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to update product";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const existing = await getAdminProductById(id);
    if (!existing) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Clean up images/videos from Supabase Storage (non-blocking)
    const imageUrls = existing.images.map((i: { url: string }) => i.url);
    await deleteMultipleFromStorage(imageUrls);

    await deleteProduct(id);
    return NextResponse.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to delete product";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
