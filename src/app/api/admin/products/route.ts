import { NextRequest, NextResponse } from "next/server";
import { getAdminFromRequest } from "@/lib/auth/admin-jwt";
import { getAllAdminProducts, createProduct } from "@/lib/data/admin-products";
import { findOrCreateCategoryByName } from "@/lib/data/admin-categories";

export async function GET(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const products = await getAllAdminProducts();
    return NextResponse.json(products);
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  const admin = getAdminFromRequest(request);
  if (!admin) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const {
      name, slug, shortDescription, description, details,
      price, shippingTax, compareAtPrice, badge,
      rating, reviewCount, stock, sku, isFeatured,
      categoryId, categoryNameNew, imageUrls,
    } = body;

    // Validation
    const errors: string[] = [];
    if (!name) errors.push("Name is required");
    if (!slug) errors.push("Slug is required");
    if (!shortDescription) errors.push("Short description is required");
    if (!description) errors.push("Description is required");
    if (!details) errors.push("Details are required");
    if (!sku) errors.push("SKU is required");
    if (!categoryId && !categoryNameNew) errors.push("Category is required");

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(". ") }, { status: 400 });
    }

    let resolvedCategoryId = categoryId;
    if (categoryNameNew) {
      const resolved = await findOrCreateCategoryByName(categoryNameNew);
      resolvedCategoryId = resolved.id;
    }

    const product = await createProduct({
      name: name.trim(),
      slug: slug.trim(),
      shortDescription: shortDescription.trim(),
      description: description.trim(),
      details: details.trim(),
      price: parseFloat(price) || 0,
      shippingTax: parseFloat(shippingTax) || 0,
      compareAtPrice: compareAtPrice != null ? parseFloat(compareAtPrice) : null,
      badge: badge || null,
      rating: parseFloat(rating) || 0,
      reviewCount: parseInt(reviewCount, 10) || 0,
      stock: parseInt(stock, 10) || 0,
      sku: sku.trim(),
      isFeatured: !!isFeatured,
      categoryId: resolvedCategoryId,
      imageUrls: imageUrls || [],
    });

    return NextResponse.json(product, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to create product";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
