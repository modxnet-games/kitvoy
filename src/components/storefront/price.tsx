"use client";

import { formatPrice } from "@/lib/formatters";

export function Price({ value, className }: { value: number; className?: string }) {
  return <span className={className}>{formatPrice(value)}</span>;
}
