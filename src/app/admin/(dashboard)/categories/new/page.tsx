import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { CategoryForm } from "../category-form";
import { createCategoryAction } from "../actions";

export default function NewCategoryPage() {
  return (
    <div>
      <Link
        href="/admin/categories"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to categories
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">New category</h1>
      <p className="mt-1 text-muted-foreground">
        Add a new product category
      </p>

      <div className="mt-8">
        <CategoryForm
          action={createCategoryAction}
          category={null}
          submitLabel="Create category"
          cancelHref="/admin/categories"
        />
      </div>
    </div>
  );
}
