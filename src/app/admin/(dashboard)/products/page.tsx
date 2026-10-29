import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { getAllAdminProducts } from "@/lib/data/admin-products";
import { formatPrice } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DeleteProductButton } from "./delete-product-button";

export const dynamic = "force-dynamic";

export default async function AdminProductsPage() {
  const products = await getAllAdminProducts();

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            Products
          </h1>
          <p className="mt-1 text-muted-foreground">
            Manage your store products — use <strong className="text-foreground">Edit</strong>{" "}
            on any row to change name, price, stock, images, category, and all other fields.
          </p>
        </div>
        <Link href="/admin/products/new">
          <Button className="rounded-xl shadow-sm">
            <Plus className="size-4" />
            New product
          </Button>
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No products yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first product to get started
            </p>
            <Link href="/admin/products/new" className="mt-4">
              <Button className="rounded-xl">Create product</Button>
            </Link>
          </div>
        ) : (
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="admin-table-header">
                <th className="px-4 py-3.5">Name</th>
                <th className="px-4 py-3.5">Slug</th>
                <th className="px-4 py-3.5">Category</th>
                <th className="px-4 py-3.5">Price</th>
                <th className="px-4 py-3.5">Compare</th>
                <th className="px-4 py-3.5">Stock</th>
                <th className="px-4 py-3.5">Featured</th>
                <th className="px-4 py-3.5">Badge</th>
                <th className="px-4 py-3.5">Orders</th>
                <th className="px-4 py-3.5">Created</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  className="border-b last:border-0 transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-3.5 font-semibold">
                    <Link
                      href={`/admin/products/${product.id}/edit`}
                      className="text-primary underline-offset-4 hover:underline"
                    >
                      {product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5 font-mono text-xs text-muted-foreground">
                    {product.slug}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {product.category.name}
                  </td>
                  <td className="px-4 py-3.5 font-semibold">
                    {formatPrice(product.price)}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {product.compareAtPrice != null
                      ? formatPrice(product.compareAtPrice)
                      : "—"}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-block size-2 rounded-full ${
                          product.stock > 5
                            ? "bg-emerald-500"
                            : product.stock > 0
                              ? "bg-amber-500"
                              : "bg-red-500"
                        }`}
                      />
                      <span
                        className={
                          product.stock > 0
                            ? "text-foreground"
                            : "text-destructive font-semibold"
                        }
                      >
                        {product.stock}
                      </span>
                      {product.stock === 0 && (
                        <Badge variant="destructive" className="text-[10px]">
                          Out
                        </Badge>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3.5">
                    {product.isFeatured ? (
                      <Badge
                        variant="secondary"
                        className="bg-emerald-50 text-emerald-700"
                      >
                        Yes
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">No</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    {product.badge ? (
                      <Badge variant="outline">{product.badge}</Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {product.ordersCount ?? 0}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {new Date(product.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/products/${product.id}/edit`}>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-lg gap-1.5 border-primary text-primary hover:bg-primary hover:text-primary-foreground font-semibold"
                        >
                          <Pencil className="size-3.5" />
                          Edit
                        </Button>
                      </Link>
                      <DeleteProductButton
                        productId={product.id}
                        productName={product.name}
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
