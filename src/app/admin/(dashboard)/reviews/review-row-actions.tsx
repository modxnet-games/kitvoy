"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  toggleReviewVisibilityAction,
  deleteReviewAction,
} from "./actions";

interface ReviewRowActionsProps {
  reviewId: string;
  isVisible: boolean;
}

export function ReviewRowActions({
  reviewId,
  isVisible,
}: ReviewRowActionsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleToggle() {
    startTransition(async () => {
      const result = await toggleReviewVisibilityAction(reviewId);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  function handleDelete() {
    const ok = confirm("Delete this review? This action cannot be undone.");
    if (!ok) return;
    startTransition(async () => {
      const result = await deleteReviewAction(reviewId);
      if (result.error) alert(result.error);
      else router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/admin/reviews/${reviewId}`}
        className="text-primary text-sm hover:underline"
      >
        View
      </Link>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleToggle}
        disabled={isPending}
        title={isVisible ? "Hide review" : "Show review"}
        className="h-8 w-8"
      >
        {isVisible ? (
          <EyeOff className="size-4 text-muted-foreground" />
        ) : (
          <Eye className="size-4 text-muted-foreground" />
        )}
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        onClick={handleDelete}
        disabled={isPending}
        title="Delete review"
        className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}
