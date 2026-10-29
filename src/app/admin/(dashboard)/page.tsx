import Link from "next/link";
import {
  Package,
  ShoppingBag,
  Star,
  TrendingUp,
  ArrowRight,
  Plus,
  Pencil,
} from "lucide-react";

import { getOrderStats } from "@/lib/data/admin-orders";

// Ensure the admin dashboard order counters update immediately after new orders.
export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  const stats = await getOrderStats();

  const statCards = [
    {
      label: "Total Orders",
      value: stats.total,
      icon: Package,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Pending",
      value: stats.pending,
      icon: ShoppingBag,
      color: "text-amber-600 bg-amber-50",
    },
    {
      label: "Delivered",
      value: stats.delivered,
      icon: Star,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Last 7 Days",
      value: stats.recent,
      icon: TrendingUp,
      color: "text-purple-600 bg-purple-50",
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
          Dashboard
        </h1>
        <p className="mt-1 text-muted-foreground">
          Welcome back! Here&apos;s an overview of your store.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => (
          <div key={card.label} className="admin-stat-card">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">
                {card.label}
              </p>
              <div
                className={`flex size-10 items-center justify-center rounded-xl ${card.color}`}
              >
                <card.icon className="size-5" />
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold tabular-nums">
              {card.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
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
          <Pencil className="size-4" />
          Edit products
        </Link>
        <Link
          href="/admin/products/new"
          className="inline-flex h-10 items-center gap-2 rounded-xl border-2 border-muted-foreground/35 bg-transparent px-5 text-sm font-bold text-foreground shadow-sm transition-all hover:border-primary hover:text-primary hover:bg-primary/5 hover:shadow-md active:scale-[0.98]"
        >
          <Plus className="size-4" />
          New product
        </Link>
      </div>
    </div>
  );
}
