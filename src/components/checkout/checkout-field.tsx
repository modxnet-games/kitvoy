"use client";

import { AlertCircle, CheckCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

interface CheckoutFieldProps extends Omit<React.ComponentProps<"input">, "className"> {
  label: string;
  /** Validation message; the field turns red and announces it */
  error?: string;
  /** Short help under the field, shown while there's no error */
  hint?: string;
  /** Marks the field optional in the label; everything else is required */
  optional?: boolean;
  /** The customer finished the field and it passed: a quiet check mark */
  valid?: boolean;
  className?: string;
}

/** The input style every checkout field shares, also used by the state select. */
export const checkoutInputClass = cn(
  "block h-12 w-full min-w-0 rounded-xl border border-[#dcd9d0] bg-white px-4 text-base text-[#171918]",
  "placeholder:text-[#9a9d99] transition-all duration-200",
  "hover:border-[#bdb9ae]",
  "focus:border-[#c94b16] focus:outline-none focus:ring-4 focus:ring-[#c94b16]/15",
  "aria-invalid:border-[#d13b2b] aria-invalid:focus:ring-[#d13b2b]/15",
  "disabled:cursor-not-allowed disabled:bg-[#f4f3ef] disabled:text-[#8a8d89]",
  "motion-reduce:transition-none",
);

export function CheckoutField({ label, error, hint, optional, valid, id, className, ...props }: CheckoutFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  const messageId = `${inputId}-message`;
  const describedBy = error || hint ? messageId : undefined;

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={inputId} className="mb-1.5 flex items-baseline justify-between gap-3 text-sm font-medium text-[#171918]">
        <span>{label}</span>
        {optional && <span className="text-xs font-normal text-[#666a67]">Optional</span>}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={inputId.replace("checkout-", "")}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(checkoutInputClass, (error || valid) && "pr-11")}
          {...props}
        />
        {error ? (
          <AlertCircle className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-[#d13b2b]" aria-hidden="true" />
        ) : valid ? (
          <CheckCircle2 className="pointer-events-none absolute right-3.5 top-1/2 size-5 -translate-y-1/2 text-[#2f7d4f]" aria-hidden="true" />
        ) : null}
      </div>
      {error ? (
        <p id={messageId} role="alert" className="mt-1.5 text-[13px] font-medium leading-snug text-[#b3261e]">
          {error}
        </p>
      ) : hint ? (
        <p id={messageId} className="mt-1.5 text-xs leading-snug text-[#666a67]">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
