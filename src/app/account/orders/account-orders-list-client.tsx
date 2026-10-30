"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useLanguage } from "@/contexts/language-context";
import { formatDate, formatPrice } from "@/lib/formatters";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { OrderStatus } from "@prisma/client";
import { CancelOrderModal } from "@/components/account/cancel-order-modal";

const STATUS_KEYS: Record<OrderStatus, string> = {
  PENDING: "account.orders.statusPending",
  CONFIRMED: "account.orders.statusConfirmed",
  PREPARING: "account.orders.statusPreparing",
  SHIPPED: "account.orders.statusShipped",
  DELIVERED: "account.orders.statusDelivered",
  CANCELED: "account.orders.statusCanceled",
};

export type OrderRow = {
  id: string;
  reference: string;
  createdAt: Date;
  status: OrderStatus;
  paymentStatus: string;
  total: number;
  itemCount: number;
};

interface AccountOrdersListClientProps {
  orders: OrderRow[];
}

function OrderStatusBadge({ status, t }: { status: OrderStatus; t: (k: string) => string }) {
  const key = STATUS_KEYS[status] ?? "account.orders.statusPending";
  const label = t(key);
  const variant =
    status === "CANCELED" ? "destructive" : status === "PENDING" ? "secondary" : "default";
  return <Badge variant={variant}>{label}</Badge>;
}

export function AccountOrdersListClient({ orders }: AccountOrdersListClientProps) {
  const { t } = useLanguage();

  const [cancelModalOrderId, setCancelModalOrderId] = useState<string | null>(null);
  const now = useMemo(() => Date.now(), []);

  function canCancelOrder(order: OrderRow) {
    if (order.status === "CANCELED" || order.status === "DELIVERED") return false;
    // Paid orders need a PayPal refund, so only the store can cancel them
    if (order.paymentStatus === "paid") return false;
    if (order.status !== "PENDING" && order.status !== "CONFIRMED") return false;

    const createdAtMs = new Date(order.createdAt).getTime();
    if (!Number.isFinite(createdAtMs)) return false;
    return now - createdAtMs <= 5 * 60 * 60 * 1000;
  }

  const cancelOrder = cancelModalOrderId
    ? orders.find((o) => o.id === cancelModalOrderId)
    : undefined;

  return (
    <div className="container px-4 py-12">
      <div className="mx-auto max-w-3xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {t("account.orders.title")}
          </h1>
          <p className="mt-1 text-muted-foreground">
            {t("account.orders.subtitle")}
          </p>
        </div>

        {orders.length === 0 ? (
          <div className="rounded-xl border bg-card p-12 text-center">
            <p className="text-muted-foreground">{t("account.orders.noOrders")}</p>
            <Link
              href="/"
              className="mt-4 inline-block text-sm font-medium text-primary hover:underline"
            >
              {t("account.orders.continueShopping")}
            </Link>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="px-4 py-3 font-medium">{t("account.orders.reference")}</th>
                  <th className="px-4 py-3 font-medium">{t("account.orders.date")}</th>
                  <th className="px-4 py-3 font-medium">{t("account.orders.status")}</th>
                  <th className="px-4 py-3 font-medium">{t("account.orders.items")}</th>
                  <th className="px-4 py-3 font-medium">{t("account.orders.total")}</th>
                  <th className="px-4 py-3 font-medium" />
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr
                    key={order.id}
                    className="border-b last:border-0 hover:bg-muted/30"
                  >
                    <td className="px-4 py-3 font-mono text-xs">
                      {order.reference}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <OrderStatusBadge status={order.status} t={t} />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {order.itemCount}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {formatPrice(order.total)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        {canCancelOrder(order) && (
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setCancelModalOrderId(order.id)}
                          >
                            {t("account.orders.cancel.short") || "Cancel"}
                          </Button>
                        )}
                        <Link
                          href={`/account/orders/${order.id}`}
                          className="text-primary hover:underline"
                        >
                          {t("account.orders.viewDetails")}
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {cancelOrder && (
        <CancelOrderModal
          open={true}
          onClose={() => setCancelModalOrderId(null)}
          orderId={cancelOrder.id}
          orderReference={cancelOrder.reference}
        />
      )}
    </div>
  );
}
