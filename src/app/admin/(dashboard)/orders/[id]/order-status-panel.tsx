"use client";

import { useState, useTransition } from "react";
import type { OrderStatus } from "@prisma/client";
import { Loader2, TriangleAlert } from "lucide-react";

import { NEXT_STEPS, STATUS_LABELS, STATUS_LIST, isRedirectError, statusLabel, type NextStep } from "@/components/admin/order-ui";
import type { CodStatus } from "@/lib/data/admin-orders";
import { cn } from "@/lib/utils";
import { updateOrderStatusAction } from "./actions";

const TONES: Record<NextStep["tone"], string> = {
  primary: "bg-primary text-primary-foreground hover:bg-primary/90",
  success: "bg-emerald-700 text-white hover:bg-emerald-800",
  neutral: "border border-input bg-card text-foreground hover:bg-muted",
  danger: "border border-destructive/40 bg-card text-destructive hover:bg-destructive/5",
};

interface OrderStatusPanelProps {
  orderId: string;
  status: OrderStatus;
  /** Whether the order's pieces are out of stock for it */
  stockHeld: boolean;
}

/**
 * Moves an order along: one tap for what usually comes next (after the call,
 * at the courier's pickup, at delivery), and a list of every status for
 * corrections.
 */
export function OrderStatusPanel({ orderId, status, stockHeld }: OrderStatusPanelProps) {
  const [isPending, startTransition] = useTransition();
  /** The status being saved; shown as chosen until the page has the answer */
  const [target, setTarget] = useState<CodStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const steps = Object.hasOwn(NEXT_STEPS, status) ? NEXT_STEPS[status as CodStatus] : [];
  const known = Object.hasOwn(STATUS_LABELS, status);

  const change = (next: CodStatus) => {
    if (next === status || isPending) return;
    setError(null);
    setWarning(null);
    setTarget(next);
    startTransition(async () => {
      try {
        const result = await updateOrderStatusAction(orderId, next);
        if (result.error) setError(result.error);
        if (result.warning) setWarning(result.warning);
      } catch (err) {
        if (!isRedirectError(err)) setError("The status wasn't changed. Check your connection and try again.");
      }
    });
  };

  return (
    <div className="space-y-4">
      {steps.length > 0 && (
        <div>
          <p className="mb-2 text-sm font-medium text-muted-foreground">Next step</p>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
            {steps.map((step, index) => (
              <button
                key={step.status}
                type="button"
                onClick={() => change(step.status)}
                disabled={isPending}
                className={cn(
                  "inline-flex h-12 items-center justify-center gap-2 rounded-xl px-5 text-sm font-bold transition-colors disabled:opacity-60 sm:h-11",
                  // The usual step takes the full width on a phone when the others would leave it alone on its row
                  index === 0 && steps.length % 2 === 1 && "col-span-2",
                  TONES[step.tone],
                )}
              >
                {isPending && target === step.status && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {step.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <label htmlFor="order-status" className="text-sm font-medium text-muted-foreground">
          Change status
        </label>
        <select
          id="order-status"
          value={isPending && target ? target : status}
          onChange={(event) => change(event.target.value as CodStatus)}
          disabled={isPending}
          className="h-10 min-w-[160px] rounded-lg border border-input bg-card px-2.5 text-base outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-60 md:text-sm"
        >
          {!known && (
            <option value={status} disabled>
              {statusLabel(status)}
            </option>
          )}
          {STATUS_LIST.map((option) => (
            <option key={option} value={option}>
              {STATUS_LABELS[option]}
            </option>
          ))}
        </select>
        {isPending && <Loader2 className="size-4 animate-spin text-muted-foreground" aria-label="Saving" />}
      </div>

      <p className="text-xs text-muted-foreground">
        {stockHeld ? "Stock: this order's pieces are out of stock, kept for it." : "Stock: this order's pieces are back in stock."}
      </p>

      {warning && (
        <p role="alert" className="flex gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{warning}</span>
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
