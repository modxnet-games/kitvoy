"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import { deleteOrderAction } from "./[id]/actions";
import { Button } from "@/components/ui/button";

interface DeleteOrderButtonProps {
  orderId: string;
  orderReference: string;
  variant?: "list" | "detail";
}

export function DeleteOrderButton({
  orderId,
  orderReference,
  variant = "list",
}: DeleteOrderButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const confirmed = window.confirm(
      `Permanently delete order ${orderReference}? This action cannot be undone.`
    );
    if (!confirmed) return;

    setError(null);
    setIsPending(true);
    try {
      const result = await deleteOrderAction(orderId);
      if (result?.error) {
        setError(result.error);
      }
    } catch (err) {
      // Redirect from server action throws; don't show error when redirecting
      if ((err as { digest?: string })?.digest !== "NEXT_REDIRECT") {
        setError("Failed to delete order");
      }
    } finally {
      setIsPending(false);
    }
  }

  return (
    <span className="inline-flex items-center gap-2">
      <Button
        type="button"
        variant={variant === "detail" ? "destructive" : "ghost"}
        size={variant === "detail" ? "default" : "icon-sm"}
        onClick={handleClick}
        disabled={isPending}
        aria-label={`Delete order ${orderReference}`}
      >
        {variant === "detail" ? (
          <>
            <Trash2 className="mr-2 size-4" />
            {isPending ? "Deleting…" : "Delete order"}
          </>
        ) : (
          <Trash2 className="size-4" />
        )}
      </Button>
      {error && (
        <span className="text-sm text-destructive" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
