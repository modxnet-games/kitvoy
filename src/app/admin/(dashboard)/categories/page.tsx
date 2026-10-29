import Link from "next/link";
import { Plus, Pencil } from "lucide-react";
import { getAllAdminCategories } from "@/lib/data/admin-categories";
import { Button } from "@/components/ui/button";
import { DeleteCategoryButton } from "./delete-category-button";

function truncate(str: string, max: number) {
  if (!str) return "—";
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

export default async function AdminCategoriesPage() {
  const categories = await getAllAdminCategories();

  return (
    <div>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Categories</h1>
          <p className="mt-1 text-muted-foreground">
            Manage product categories
          </p>
        </div>
        <Link href="/admin/categories/new">
          <Button>
            <Plus className="size-4" />
            New category
          </Button>
        </Link>
      </div>

      <div className="mt-8 overflow-x-auto rounded-xl border bg-card">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-muted-foreground">No categories yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create a category to organize your products
            </p>
            <Link href="/admin/categories/new" className="mt-4">
              <Button>Create category</Button>
            </Link>
          </div>
        ) : (
          <table className="w-full min-w-[700px] text-left text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Slug</th>
                <th className="px-4 py-3 font-medium">Description</th>
                <th className="px-4 py-3 font-medium">Products</th>
                <th className="px-4 py-3 font-medium">Menu</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {categories.map((cat) => (
                <tr
                  key={cat.id}
                  className="border-b last:border-0 hover:bg-muted/30"
                >
                  <td className="px-4 py-3 font-medium">{cat.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                    {cat.slug}
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-muted-foreground">
                    {truncate(cat.description ?? "", 50)}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {cat._count.products}
                  </td>
                  <td className="px-4 py-3">
                    {cat.showInMenu ? (
                      <span className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                        Visible
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                        Hidden
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(cat.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Link href={`/admin/categories/${cat.id}/edit`}>
                        <Button variant="ghost" size="icon-sm">
                          <Pencil className="size-4" />
                        </Button>
                      </Link>
                      <DeleteCategoryButton
                        categoryId={cat.id}
                        categoryName={cat.name}
                        productCount={cat._count.products}
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
