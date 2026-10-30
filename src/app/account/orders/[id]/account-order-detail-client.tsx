"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";
import { useMemo, useState } from "react";
import { formatPrice } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@prisma/client";
import type { CustomerOrderDetail } from "@/lib/data/customer-orders";
import { CancelOrderModal } from "@/components/account/cancel-order-modal";

const STATUS_KEYS: Record<OrderStatus, string> = {
  PENDING: "account.orders.statusPending",
  CONFIRMED: "account.orders.statusConfirmed",
  PREPARING: "account.orders.statusPreparing",
  SHIPPED: "account.orders.statusShipped",
  DELIVERED: "account.orders.statusDelivered",
  CANCELED: "account.orders.statusCanceled",
};

interface AccountOrderDetailClientProps {
  order: CustomerOrderDetail & { reference: string };
}

export function AccountOrderDetailClient({ order }: AccountOrderDetailClientProps) {
  const { t } = useLanguage();
  const statusLabel = t(STATUS_KEYS[order.status] ?? "account.orders.statusPending");
  const now = useMemo(() => Date.now(), []);
  const [cancelOpen, setCancelOpen] = useState(false);

  function canCancelOrder() {
    if (order.status === "CANCELED" || order.status === "DELIVERED") return false;
    if (order.status !== "PENDING" && order.status !== "CONFIRMED") return false;
    const createdAtMs = new Date(order.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) return false;
    return now - createdAtMs <= 5 * 60 * 60 * 1000;
  }

  return (
    <div className="container px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-8">
        <Link
          href="/account/orders"
          className="inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          ← {t("account.orders.backToOrders")}
        </Link>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("account.orders.orderDetails")} {order.reference}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString("en-US")}
          </p>
          <div className="mt-2">
            <Badge
              variant={
                order.status === "CANCELED"
                  ? "destructive"
                  : order.status === "PENDING"
                    ? "secondary"
                    : "default"
              }
            >
              {statusLabel}
            </Badge>
          </div>

          {canCancelOrder() && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => setCancelOpen(true)}
              >
                {t("account.orders.cancel.short") || "Cancel order"}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t("account.orders.cancel.withinFiveHours") ||
                  "You can cancel within the first 5 hours."}
              </span>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-6">
          <h2 className="font-semibold">{t("account.orders.items")}</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-3 font-medium">{t("account.orders.product")}</th>
                  <th className="pb-3 font-medium text-right">{t("account.orders.qty")}</th>
                  <th className="pb-3 font-medium text-right">{t("account.orders.unitPrice")}</th>
                  <th className="pb-3 font-medium text-right">{t("account.orders.lineTotal")}</th>
                </tr>
              </thead>
              <tbody>
                {order.items.map((item) => (
                  <tr key={item.id} className="border-b last:border-0">
                    <td className="py-3">
                      <Link
                        href="/"
                        className="font-medium text-primary hover:underline"
                      >
                        {item.productName}
                      </Link>
                    </td>
                    <td className="py-3 text-right">{item.quantity}</td>
                    <td className="py-3 text-right text-muted-foreground">
                      {formatPrice(item.unitPrice)}
                    </td>
                    <td className="py-3 text-right font-medium">
                      {formatPrice(item.lineTotal)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 flex justify-end border-t pt-4">
            <div className="space-y-1 text-right text-sm">
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">{t("account.orders.subtotal")}</span>
                <span>{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between gap-8">
                <span className="text-muted-foreground">{t("account.orders.shipping")}</span>
                <span>
                  {order.shippingCost === 0
                    ? t("cart.free")
                    : formatPrice(order.shippingCost)}
                </span>
              </div>
              <div className="flex justify-between gap-8 font-semibold">
                <span>{t("account.orders.total")}</span>
                <span>{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/30">
          <p className="font-medium text-amber-900 dark:text-amber-100">
            {t("order.shippingMessage")}
          </p>
        </div>

        {cancelOpen && (
          <CancelOrderModal
            open={true}
            onClose={() => setCancelOpen(false)}
            orderId={order.id}
            orderReference={order.reference}
          />
        )}
      </div>
    </div>
  );
}
