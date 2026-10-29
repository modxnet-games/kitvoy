import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "../product-form";
import { getAllCategories } from "@/lib/data/categories";
import { createProductFormAction } from "../actions";

export default async function NewProductPage() {
  const categories = await getAllCategories();

  return (
    <div>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to products
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">New product</h1>
      <p className="mt-1 text-muted-foreground">
        Add a new product to your store
      </p>

      <div className="mt-8">
        <ProductForm
          action={createProductFormAction}
          categories={categories}
          product={null}
          submitLabel="Create product"
        />
      </div>
    </div>
  );
}
