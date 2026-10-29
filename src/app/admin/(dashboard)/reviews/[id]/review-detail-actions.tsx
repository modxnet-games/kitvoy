"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  toggleReviewVisibilityAction,
  deleteReviewAction,
} from "../actions";

interface ReviewDetailActionsProps {
  reviewId: string;
  isVisible: boolean;
}

export function ReviewDetailActions({
  reviewId,
  isVisible,
}: ReviewDetailActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleReviewVisibilityAction(reviewId);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.refresh();
    });
  }

  function handleDelete() {
    const ok = confirm("Delete this review? This action cannot be undone.");
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteReviewAction(reviewId);
      if (result.error) {
        alert(result.error);
        return;
      }
      router.replace("/admin/reviews");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handleToggle}
        disabled={isPending}
      >
        {isVisible ? (
          <>
            <EyeOff className="mr-1.5 size-4" />
            Hide
          </>
        ) : (
          <>
            <Eye className="mr-1.5 size-4" />
            Show
          </>
        )}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleDelete}
        disabled={isPending}
        className="text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="mr-1.5 size-4" />
        Delete
      </Button>
    </div>
  );
}
