import type { OrderStatus } from "@prisma/client";

import { cn } from "@/lib/utils";
import { statusLabel } from "./order-ui";

/**
 * One colour per status, so a list can be read at a glance: blue to call,
 * amber to call again, teal ready to ship, violet on the road, green (solid:
 * the cash is in) delivered, red sent back, grey canceled.
 */
const STATUS_COLOURS: Record<OrderStatus, string> = {
  PENDING: "bg-blue-100 text-blue-800",
  NO_ANSWER: "bg-amber-100 text-amber-900",
  CONFIRMED: "bg-teal-100 text-teal-800",
  SHIPPED: "bg-violet-100 text-violet-800",
  DELIVERED: "bg-emerald-700 text-white",
  RETURNED: "bg-red-100 text-red-800",
  CANCELED: "bg-zinc-200 text-zinc-700",
  // Never set any more; shown plainly if a row of the old store still has it
  PREPARING: "bg-muted text-muted-foreground",
};

interface StatusBadgeProps {
  status: OrderStatus;
  /** "lg" for the top of an order's page */
  size?: "sm" | "lg";
  className?: string;
}

export function StatusBadge({ status, size = "sm", className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full font-semibold whitespace-nowrap",
        size === "lg" ? "px-4 py-1.5 text-base" : "px-2.5 py-0.5 text-xs",
        STATUS_COLOURS[status] ?? STATUS_COLOURS.PREPARING,
        className,
      )}
    >
      {statusLabel(status)}
    </span>
  );
}
