"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface CategoryFormProps {
  action: (formData: FormData) => Promise<{ error?: string }>;
  category?: {
    name: string;
    slug: string;
    description: string | null;
    showInMenu?: boolean;
  } | null;
  categoryId?: string;
  submitLabel: string;
  cancelHref: string;
}

export function CategoryForm({
  action,
  category,
  categoryId,
  submitLabel,
  cancelHref,
}: CategoryFormProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setIsPending(true);
    const result = await action(formData);
    setIsPending(false);
    if (result?.error) {
      setError(result.error);
    }
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {categoryId && (
        <input type="hidden" name="categoryId" value={categoryId} readOnly />
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
        <h2 className="font-semibold">Category details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium">
              Name *
            </label>
            <Input
              id="name"
              name="name"
              required
              defaultValue={category?.name}
              placeholder="Category name"
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
              defaultValue={category?.slug}
              placeholder="category-slug"
              className="font-mono text-sm"
            />
          </div>
        </div>
        <div>
          <label htmlFor="description" className="mb-1.5 block text-sm font-medium">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            defaultValue={category?.description ?? ""}
            placeholder="Optional description"
            className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 md:text-sm"
          />
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showInMenu"
            name="showInMenu"
            defaultChecked={category?.showInMenu ?? true}
            className="size-4 rounded border-input accent-primary"
          />
          <label htmlFor="showInMenu" className="text-sm font-medium">
            Show in menu &amp; homepage
          </label>
          <span className="text-xs text-muted-foreground">
            When enabled, this category appears in the storefront navigation and homepage.
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving…" : submitLabel}
        </Button>
        <Link href={cancelHref}>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
      </div>
    </form>
  );
}
