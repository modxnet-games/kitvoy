import type { FulfillmentStatus } from "@prisma/client";

import { cn } from "@/lib/utils";

const STYLES: Record<FulfillmentStatus, { label: string; className: string }> = {
  UNFULFILLED: { label: "Unfulfilled", className: "bg-muted text-muted-foreground" },
  SHIPPED: { label: "Shipped", className: "bg-sky-100 text-sky-800" },
  DELIVERED: { label: "Delivered", className: "bg-emerald-100 text-emerald-800" },
};

export function FulfillmentBadge({ status, className }: { status: FulfillmentStatus; className?: string }) {
  const style = STYLES[status] ?? STYLES.UNFULFILLED;
  return (
    <span className={cn("inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold", style.className, className)}>
      {style.label}
    </span>
  );
}
