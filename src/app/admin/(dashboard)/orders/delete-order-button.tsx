"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";

import { isRedirectError } from "@/components/admin/order-ui";
import { Button } from "@/components/ui/button";
import { deleteOrderAction } from "./[id]/actions";

interface DeleteOrderButtonProps {
  orderId: string;
  orderReference: string;
  /** What else deleting does (the stock, the sales figures), said in the confirmation */
  consequence?: string;
}

export function DeleteOrderButton({ orderId, orderReference, consequence }: DeleteOrderButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    const question = [`Permanently delete order ${orderReference}?`, consequence, "This cannot be undone."].filter(Boolean).join(" ");
    if (!window.confirm(question)) return;

    setError(null);
    setIsPending(true);
    try {
      const result = await deleteOrderAction(orderId);
      if (result?.error) setError(result.error);
    } catch (err) {
      // Once deleted, the action sends the browser back to the list: that arrives here as a redirect, not a failure
      if (!isRedirectError(err)) setError("Failed to delete order");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <Button type="button" variant="destructive" onClick={handleClick} disabled={isPending} className="h-10 px-4">
        <Trash2 className="size-4" aria-hidden />
        {isPending ? "Deleting…" : "Delete order"}
      </Button>
      {error && (
        <span className="text-sm text-destructive" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
