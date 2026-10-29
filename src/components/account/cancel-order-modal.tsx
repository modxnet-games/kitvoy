"use client";

import { useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";

interface CancelOrderModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string;
  orderReference?: string;
}

export function CancelOrderModal({
  open,
  onClose,
  orderId,
  orderReference,
}: CancelOrderModalProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  async function handleCancelOrder() {
    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ orderId }),
      });

      const json = (await res.json().catch(() => null)) as
        | { error?: string }
        | null;

      if (!res.ok) {
        // Keep it simple: show server error key directly.
        // (LanguageProvider returns key itself if missing)
        setError(json?.error ?? "CANCEL_FAILED");
        return;
      }

      // Refresh server components so the order status updates.
      router.refresh();
      onClose();
    } catch {
      setError("CANCEL_FAILED");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-lg rounded-2xl border bg-background p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold tracking-tight">
              {t("account.orders.cancel.title") || "Cancel order"}
            </h2>
            {orderReference && (
              <p className="mt-1 text-sm text-muted-foreground">
                {t("account.orders.cancel.reference") || "Order"}:{" "}
                <span className="font-mono">{orderReference}</span>
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Close"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-4 text-sm text-muted-foreground">
          {t("account.orders.cancel.message") ||
            "You can cancel within the first 5 hours after placing the order."}
        </p>

        {error && (
          <div
            className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
            role="alert"
          >
            {t(`account.orders.cancel.errors.${error}`) || error}
          </div>
        )}

        <div className="mt-7 flex flex-wrap items-center justify-end gap-3">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("account.orders.cancel.close") || "Close"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleCancelOrder}
            disabled={isSubmitting}
          >
            {isSubmitting
              ? t("account.orders.cancel.submitting") || "Canceling..."
              : t("account.orders.cancel.action") || "Cancel order"}
          </Button>
        </div>

        {/*
          Optional: if the user hits "too late" they can still review details.
          Link kept for UX, doesn't affect logic.
        */}
        {orderId && (
          <div className="mt-4 text-right text-xs text-muted-foreground">
            <Link
              href={`/account/orders/${orderId}`}
              className="hover:text-foreground hover:underline"
            >
              {t("account.orders.cancel.viewDetails") ||
                "View order details"}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

