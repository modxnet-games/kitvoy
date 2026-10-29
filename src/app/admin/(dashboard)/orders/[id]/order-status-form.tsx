"use client";

import { useTransition } from "react";
import { updateOrderStatusAction } from "./actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OrderStatus } from "@prisma/client";

const STATUS_OPTIONS: OrderStatus[] = [
  "PENDING",
  "CONFIRMED",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
];

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  CONFIRMED: "Confirmed",
  PREPARING: "Preparing",
  SHIPPED: "Shipped",
  DELIVERED: "Delivered",
  CANCELED: "Canceled",
};

interface OrderStatusFormProps {
  orderId: string;
  currentStatus: OrderStatus;
  disabled?: boolean;
}

export function OrderStatusForm({
  orderId,
  currentStatus,
  disabled = false,
}: OrderStatusFormProps) {
  const [isPending, startTransition] = useTransition();

  const handleChange = (value: string | null) => {
    if (!value || value === currentStatus) return;
    startTransition(() => {
      updateOrderStatusAction(orderId, value as OrderStatus);
    });
  };

  return (
    <Select
      value={currentStatus}
      onValueChange={handleChange}
      disabled={disabled || isPending}
    >
      <SelectTrigger className="w-[140px]" aria-label="Update order status">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {STATUS_OPTIONS.map((status) => (
          <SelectItem key={status} value={status}>
            {STATUS_LABELS[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
