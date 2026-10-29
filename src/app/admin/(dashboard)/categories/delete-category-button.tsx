"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { deleteCategoryAction } from "./actions";

interface DeleteCategoryButtonProps {
  categoryId: string;
  categoryName: string;
  productCount: number;
}

export function DeleteCategoryButton({
  categoryId,
  categoryName,
  productCount,
}: DeleteCategoryButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleClick() {
    const ok = confirm(
      productCount > 0
        ? `"${categoryName}" has ${productCount} product(s). Cannot delete a category that is in use. Remove or reassign those products first.`
        : `Delete "${categoryName}"? This action cannot be undone.`
    );
    if (!ok) return;

    setIsPending(true);
    const result = await deleteCategoryAction(categoryId);
    setIsPending(false);

    if (result.error) {
      alert(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      onClick={handleClick}
      disabled={isPending || productCount > 0}
      title={
        productCount > 0
          ? "Cannot delete: category is in use by products"
          : "Delete category"
      }
      className="text-destructive hover:bg-destructive/10 hover:text-destructive"
    >
      <Trash2 className="size-4" />
    </Button>
  );
}
