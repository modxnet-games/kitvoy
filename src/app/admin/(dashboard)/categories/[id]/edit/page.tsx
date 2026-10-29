import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAdminCategoryById } from "@/lib/data/admin-categories";
import { CategoryForm } from "../../category-form";
import { updateCategoryAction } from "../../actions";

interface EditCategoryPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditCategoryPage({ params }: EditCategoryPageProps) {
  const { id } = await params;
  const category = await getAdminCategoryById(id);

  if (!category) notFound();

  return (
    <div>
      <Link
        href="/admin/categories"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to categories
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        Edit: {category.name}
      </h1>
      <p className="mt-1 text-muted-foreground">
        Update category details
      </p>

      <div className="mt-8">
        <CategoryForm
          action={updateCategoryAction}
          category={category}
          categoryId={id}
          submitLabel="Save changes"
          cancelHref="/admin/categories"
        />
      </div>
    </div>
  );
}
