import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductForm } from "../../product-form";
import { getAdminProductById } from "@/lib/data/admin-products";
import { getAllCategories } from "@/lib/data/categories";
import { updateProductFormAction } from "../../actions";

interface EditProductPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const { id } = await params;
  const [product, categories] = await Promise.all([
    getAdminProductById(id),
    getAllCategories(),
  ]);

  if (!product) notFound();

  return (
    <div>
      <Link
        href="/admin/products"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to products
      </Link>
      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        Edit: {product.name}
      </h1>
      <p className="mt-1 text-muted-foreground">
        Update product details
      </p>

      <div className="mt-8">
        <ProductForm
          action={updateProductFormAction}
          productId={id}
          categories={categories}
          product={product}
          submitLabel="Save changes"
        />
      </div>
    </div>
  );
}
