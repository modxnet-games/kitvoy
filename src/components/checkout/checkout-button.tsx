"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface CheckoutButtonProps extends Omit<React.ComponentProps<"button">, "children"> {
  children: React.ReactNode;
  /** Shows a spinner with this text, and blocks clicks, while the step runs */
  loading?: boolean;
  loadingLabel?: string;
}

/**
 * The one primary button of the checkout (Continue to payment, Pay). Same
 * height, radius and brand color as the storefront's buttons, full width, with
 * a lift on hover and a clear busy state so nobody taps twice.
 */
export function CheckoutButton({ children, loading = false, loadingLabel, disabled, className, type = "button", ...props }: CheckoutButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex h-13 w-full items-center justify-center gap-2.5 rounded-xl bg-[#c94b16] px-6 text-[15px] font-semibold text-white",
        "shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_10px_20px_-14px_rgba(201,75,22,0.8)] transition-all duration-200",
        "hover:-translate-y-0.5 hover:bg-[#ae3d0e] hover:shadow-[0_1px_0_rgba(255,255,255,0.2)_inset,0_16px_26px_-14px_rgba(201,75,22,0.9)]",
        "active:translate-y-0 active:scale-[0.99] active:shadow-none",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#c94b16]/25",
        "disabled:translate-y-0 disabled:cursor-not-allowed disabled:shadow-none",
        loading ? "disabled:bg-[#c94b16]/80 disabled:text-white" : "disabled:bg-[#e7e5df] disabled:text-[#666a67]",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2.5" role="status">
          <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          {loadingLabel ?? children}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
