"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ProductImageManager } from "@/components/admin/product-image-manager";
import type { Product } from "@prisma/client";

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface ProductFormProps {
  action: (formData: FormData) => Promise<{ error?: string }>;
  categories: Category[];
  productId?: string;
  product?: Product & {
    category: Category;
    images: { id: string; url: string; alt: string | null; order: number }[];
  } | null;
  submitLabel: string;
}

export function ProductForm({
  action,
  categories,
  productId,
  product,
  submitLabel,
}: ProductFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [imageUrls, setImageUrls] = useState<string[]>(
    product?.images?.length
      ? product.images.map((i) => i.url)
      : [""]
  );

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsPending(true);
    const result = await action(formData);
    setIsPending(false);
    if (result?.error) {
      setError(result.error);
      return;
    }
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {productId && (
        <input type="hidden" name="productId" value={productId} readOnly />
      )}
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div className="space-y-6 rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Basic info</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Name *
            </label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={product?.name}
              placeholder="Product name"
            />
          </div>
          <div>
            <label htmlFor="slug" className="mb-1.5 block text-sm font-medium">
              Slug *
            </label>
            <Input
              id="slug"
              name="slug"
              required
              defaultValue={product?.slug}
              placeholder="product-slug"
              className="font-mono text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="shortDescription" className="mb-1.5 block text-sm font-medium">
            Short description *
          </label>
          <Input
            id="shortDescription"
            name="shortDescription"
            required
            defaultValue={product?.shortDescription}
            placeholder="Brief summary for cards"
          />
        </div>
        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
            Description *
          </label>
          <textarea
            id="description"
            name="description"
            required
            rows={4}
            defaultValue={product?.description}
            placeholder="Full product description"
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm"
          />
        </div>
        <div>
          <label htmlFor="details" className="mb-1.5 block text-sm font-medium">
            Details *
          </label>
          <textarea
            id="details"
            name="details"
            required
            rows={3}
            defaultValue={product?.details}
            placeholder="Product details"
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm"
          />
        </div>
      </div>

      <div className="space-y-6 rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Pricing & inventory</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <label htmlFor="price" className="mb-1.5 block text-sm font-medium">
              Price (USD) *
            </label>
            <Input
              id="price"
              name="price"
              type="number"
              step="0.01"
              min="0"
              required
              defaultValue={product?.price}
            />
          </div>
          <div>
            <label htmlFor="compareAtPrice" className="mb-1.5 block text-sm font-medium">
              Compare at price (USD)
            </label>
            <Input
              id="compareAtPrice"
              name="compareAtPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.compareAtPrice ?? ""}
              placeholder="Optional"
            />
          </div>
          <div>
            <label htmlFor="shippingTax" className="mb-1.5 block text-sm font-medium">
              Shipping tax / delivery cost (USD)
            </label>
            <Input
              id="shippingTax"
              name="shippingTax"
              type="number"
              step="0.01"
              min="0"
              defaultValue={product?.shippingTax ?? 0}
            />
          </div>
          <div>
            <label htmlFor="stock" className="mb-1.5 block text-sm font-medium">
              Stock *
            </label>
            <Input
              id="stock"
              name="stock"
              type="number"
              min="0"
              required
              defaultValue={product?.stock}
            />
          </div>
          <div>
            <label htmlFor="sku" className="mb-1.5 block text-sm font-medium">
              SKU *
            </label>
            <Input
              id="sku"
              name="sku"
              required
              defaultValue={product?.sku}
              placeholder="SKU-001"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Display & reviews</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label htmlFor="badge" className="mb-1.5 block text-sm font-medium">
              Badge
            </label>
            <select
              id="badge"
              name="badge"
              defaultValue={product?.badge ?? ""}
              className="flex h-8 w-full items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">None</option>
              <option value="New">New</option>
              <option value="Sale">Sale</option>
              <option value="Bestseller">Bestseller</option>
            </select>
          </div>
          <div>
            <label htmlFor="rating" className="mb-1.5 block text-sm font-medium">
              Rating (0–5)
            </label>
            <Input
              id="rating"
              name="rating"
              type="number"
              step="0.1"
              min="0"
              max="5"
              defaultValue={product?.rating}
            />
          </div>
          <div>
            <label htmlFor="reviewCount" className="mb-1.5 block text-sm font-medium">
              Review count
            </label>
            <Input
              id="reviewCount"
              name="reviewCount"
              type="number"
              min="0"
              defaultValue={product?.reviewCount}
            />
          </div>
          <div className="flex items-end pb-2">
            <label className="flex cursor-pointer items-center gap-2">
              <input
                type="checkbox"
                name="isFeatured"
                defaultChecked={product?.isFeatured}
                value="on"
                className="size-4 rounded border-input"
              />
              <span className="text-sm font-medium">Featured</span>
            </label>
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Category</h2>
        <div className="space-y-4">
          <div>
            <label htmlFor="categoryId" className="mb-1.5 block text-sm font-medium">
              Existing category
            </label>
            <select
              id="categoryId"
              name="categoryId"
              defaultValue={product?.categoryId ?? ""}
              className="flex h-8 w-full min-w-[200px] items-center justify-between rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <option value="">Select category (or create new below)</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="categoryNameNew" className="mb-1.5 block text-sm font-medium">
              Or create new category
            </label>
            <Input
              id="categoryNameNew"
              name="categoryNameNew"
              defaultValue=""
              placeholder="e.g. Summer Collection"
              className="max-w-sm"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Type a name; if it already exists it will be reused, otherwise a new category is created.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6 rounded-xl border bg-card p-6">
        <h2 className="font-semibold">Media (images and video)</h2>
        <ProductImageManager value={imageUrls} onChange={setImageUrls} />
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : submitLabel}
        </Button>
        <Link href="/admin/products">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
