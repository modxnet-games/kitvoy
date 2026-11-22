import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Banknote, Boxes, PhoneCall, Truck, type LucideIcon } from "lucide-react";

import { CONFIRMED_OR_LATER, DELIVERED_OR_RETURNED, TO_CALL, formatRate, itemsSummary, ordersHref } from "@/components/admin/order-ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { getCodOverview } from "@/lib/data/sales-overview";
import { STORE_TIME_ZONE, formatDateTime, formatPrice } from "@/lib/formatters";
import { cn } from "@/lib/utils";

// The counters follow the orders as they come in
export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Dashboard" };

interface StatCardProps {
  href: string;
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  /** Colours of the icon tile */
  tone?: string;
}

function StatCard({ href, label, value, hint, icon: Icon, tone }: StatCardProps) {
  return (
    <Link href={href} className="rounded-xl border bg-card p-4 transition-shadow hover:shadow-md sm:p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        {Icon && (
          <div className={cn("flex size-9 shrink-0 items-center justify-center rounded-xl", tone)}>
            <Icon className="size-5" />
          </div>
        )}
      </div>
      <p className="mt-2 text-2xl font-bold tabular-nums sm:text-3xl">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </Link>
  );
}

export default async function AdminDashboardPage() {
  const now = new Date();
  const { counts, toCall, toShip, inDelivery, today, month, recent } = await getCodOverview(now);
  const monthName = now.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: STORE_TIME_ZONE });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Dashboard</h1>
        <p className="mt-1 text-muted-foreground">
          Today: {today.orders} {today.orders === 1 ? "order" : "orders"} placed ({formatPrice(today.value)}), {today.confirmed} confirmed.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard
          href={ordersHref({ status: TO_CALL })}
          label="To call"
          value={toCall}
          hint={`${counts.PENDING} new · ${counts.NO_ANSWER} no answer`}
          icon={PhoneCall}
          tone="bg-blue-50 text-blue-700"
        />
        <StatCard
          href={ordersHref({ status: ["CONFIRMED"] })}
          label="To ship"
          value={toShip}
          hint="Confirmed, to hand to the courier"
          icon={Boxes}
          tone="bg-teal-50 text-teal-700"
        />
        <StatCard
          href={ordersHref({ status: ["SHIPPED"] })}
          label="In delivery"
          value={inDelivery}
          hint="With the courier"
          icon={Truck}
          tone="bg-violet-50 text-violet-700"
        />
        <StatCard
          href={ordersHref({ status: ["DELIVERED"] })}
          label="Delivered today"
          value={today.delivered}
          hint={`${formatPrice(today.deliveredRevenue)} collected`}
          icon={Banknote}
          tone="bg-emerald-50 text-emerald-700"
        />
      </div>

      <h2 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">{monthName}</h2>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
        <StatCard href={ordersHref()} label="Orders" value={month.orders} hint={`${formatPrice(month.value)} ordered`} />
        <StatCard
          href={ordersHref({ status: ["DELIVERED"] })}
          label="Delivered revenue"
          value={formatPrice(month.deliveredRevenue)}
          hint={`${month.delivered} delivered`}
        />
        <StatCard
          href={ordersHref({ status: CONFIRMED_OR_LATER })}
          label="Confirmation rate"
          value={formatRate(month.confirmationRate)}
          hint={`Of this month's orders · ${month.canceled} canceled`}
        />
        <StatCard
          href={ordersHref({ status: DELIVERED_OR_RETURNED })}
          label="Delivery rate"
          value={formatRate(month.deliveryRate)}
          hint={`Delivered rather than returned · ${month.returned} returned`}
        />
      </div>

      <div className="mt-8 rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
          <h2 className="font-semibold">Newest orders</h2>
          <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline">
            All orders
            <ArrowRight className="size-4" />
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-5">No orders yet. They appear here as customers place them.</p>
        ) : (
          <ul className="divide-y">
            {recent.map((order) => (
              <li key={order.id}>
                <Link href={`/admin/orders/${order.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/40 sm:px-5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {order.customerName}
                      {order.city && <span className="font-normal text-muted-foreground"> · {order.city}</span>}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">{itemsSummary(order.items)}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      <span className="font-mono">{order.reference}</span> · {formatDateTime(order.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1.5">
                    <span className="font-semibold tabular-nums">{formatPrice(order.total)}</span>
                    <StatusBadge status={order.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link
          href="/admin/orders"
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-5 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.98]"
        >
          View all orders
          <ArrowRight className="size-4" />
        </Link>
        <Link
          href="/admin/products"
          className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-primary bg-transparent px-5 text-sm font-bold text-primary shadow-sm transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-md active:scale-[0.98]"
        >
          Products and stock
        </Link>
      </div>
    </div>
  );
}
