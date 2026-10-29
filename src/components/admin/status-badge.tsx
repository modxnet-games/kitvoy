import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { OrderStatus } from "@prisma/client";

const STATUS_STYLES: Record<
  OrderStatus,
  { variant: "default" | "secondary" | "destructive" | "outline"; label: string }
> = {
  PENDING: { variant: "secondary", label: "Pending" },
  CONFIRMED: { variant: "default", label: "Confirmed" },
  PREPARING: { variant: "default", label: "Preparing" },
  SHIPPED: { variant: "default", label: "Shipped" },
  DELIVERED: { variant: "default", label: "Delivered" },
  CANCELED: { variant: "destructive", label: "Canceled" },
};

interface StatusBadgeProps {
  status: OrderStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = STATUS_STYLES[status] ?? {
    variant: "secondary" as const,
    label: status,
  };
  return (
    <Badge variant={style.variant} className={cn(className)}>
      {style.label}
    </Badge>
  );
}
