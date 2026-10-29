"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface CheckoutFieldProps
  extends Omit<React.ComponentProps<"input">, "className"> {
  label: string;
  error?: string;
  required?: boolean;
  className?: string;
}

export function CheckoutField({
  label,
  error,
  required,
  id,
  className,
  ...props
}: CheckoutFieldProps) {
  const inputId = id ?? label.toLowerCase().replace(/\s+/g, "-");

  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={inputId} className="text-sm font-medium">
        {label}
        {required && <span className="text-destructive"> *</span>}
      </label>
      <Input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={error ? "border-destructive" : undefined}
        {...props}
      />
      {error && (
        <p id={`${inputId}-error`} className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
