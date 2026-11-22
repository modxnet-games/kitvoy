import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { ChevronRight, MessageCircle, Phone, Printer, Search } from "lucide-react";

import { STATUS_LABELS, STATUS_LIST, itemsSummary, ordersHref } from "@/components/admin/order-ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { MAX_ORDER_LIMIT, countOrdersByStatus, listOrders, parseStatusFilter, serializeOrder } from "@/lib/data/admin-orders";
import { formatDateTime, formatPrice } from "@/lib/formatters";
import { formatMoroccanPhone } from "@/lib/morocco";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export const metadata: Metadata = { title: "Orders" };

/** Orders shown at first, and added by each "Show more" */
const PAGE_SIZE = 100;

type Param = string | string[] | undefined;
const first = (value: Param) => (Array.isArray(value) ? value[0] : value) ?? "";

interface OrdersPageProps {
  searchParams: Promise<{ status?: Param; q?: Param; show?: Param }>;
}

export default async function AdminOrdersPage({ searchParams }: OrdersPageProps) {
  const params = await searchParams;
  const q = first(params.q).trim().slice(0, 80);
  // A status the list doesn't know shows every order
  const statuses = parseStatusFilter(first(params.status)) ?? [];
  const asked = Number.parseInt(first(params.show), 10);
  const show = Math.min(Math.max(Number.isFinite(asked) ? asked : PAGE_SIZE, PAGE_SIZE), MAX_ORDER_LIMIT);

  const [orders, counts] = await Promise.all([listOrders({ status: statuses, q, limit: show }), countOrdersByStatus(q)]);
  const rows = orders.map(serializeOrder);
  const total = STATUS_LIST.reduce((sum, status) => sum + counts[status], 0);
  const matching = statuses.length > 0 ? statuses.reduce((sum, status) => sum + counts[status], 0) : total;
  const filtered = statuses.length > 0 || q !== "";

  const tabs = [
    { key: "ALL", label: "All", count: total, href: ordersHref({ q }), active: statuses.length === 0 },
    ...STATUS_LIST.map((status) => ({
      key: status,
      label: STATUS_LABELS[status],
      count: counts[status],
      href: ordersHref({ status: [status], q }),
      active: statuses.includes(status),
    })),
  ];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Orders</h1>
        <p className="mt-1 text-muted-foreground">Call to confirm, hand to the courier, mark delivered or returned.</p>
      </div>

      {/* Keyed by the search, so "Clear" also empties the box */}
      <Form key={q} action="/admin/orders" role="search" className="mb-4 flex gap-2">
        {statuses.length > 0 && <input type="hidden" name="status" value={statuses.join(",")} />}
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <input
            type="search"
            name="q"
            defaultValue={q}
            placeholder="Reference, name, phone or city"
            aria-label="Search orders"
            enterKeyHint="search"
            className="h-10 w-full rounded-xl border border-input bg-card pl-9 pr-3 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
          />
        </div>
        <button
          type="submit"
          className="inline-flex h-10 shrink-0 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Search
        </button>
        {q && (
          <Link
            href={ordersHref({ status: statuses })}
            className="inline-flex h-10 shrink-0 items-center rounded-xl border bg-card px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Clear
          </Link>
        )}
      </Form>

      <nav aria-label="Orders by status" className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
        {tabs.map((tab) => (
          <Link
            key={tab.key}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold transition-colors",
              tab.active ? "border-primary bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
            )}
          >
            {tab.label}
            <span className={cn("rounded-full px-1.5 text-xs tabular-nums", tab.active ? "bg-primary-foreground/20" : "bg-muted")}>{tab.count}</span>
          </Link>
        ))}
      </nav>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border bg-card px-4 py-16 text-center shadow-sm">
          <p className="text-lg font-medium text-muted-foreground">{filtered ? "No orders match" : "No orders yet"}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {filtered ? "Try another status or search." : "Orders appear here as customers place them."}
          </p>
          {filtered && (
            <Link href="/admin/orders" className="mt-4 text-sm font-semibold text-primary hover:underline">
              Show all orders
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* Phones, and windows too narrow for the table: one card per order, with the call buttons under the thumb */}
          <ul className="grid gap-3 lg:grid-cols-2 xl:hidden">
            {rows.map((order) => (
              <li key={order.id} className="rounded-xl border bg-card p-4 shadow-sm">
                <Link href={`/admin/orders/${order.id}`} className="block">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-base font-semibold">{order.customerName}</p>
                      <p className="truncate text-sm text-muted-foreground">{order.city ?? order.location}</p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-2 text-sm">{itemsSummary(order.items)}</p>
                  <div className="mt-2 flex items-end justify-between gap-3">
                    <span className="text-lg font-bold tabular-nums">{formatPrice(order.total)}</span>
                    <span className="text-right text-xs text-muted-foreground">
                      <span className="font-mono">{order.reference}</span>
                      <br />
                      {formatDateTime(order.createdAt)}
                    </span>
                  </div>
                </Link>
                <div className="mt-3 flex gap-2">
                  <a
                    href={`tel:${order.phoneE164 ?? order.phone}`}
                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 text-sm font-bold whitespace-nowrap text-primary-foreground"
                  >
                    <Phone className="size-4 shrink-0" aria-hidden />
                    {formatMoroccanPhone(order.phone)}
                  </a>
                  {order.whatsappUrl && (
                    <a
                      href={order.whatsappUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`WhatsApp ${order.customerName}`}
                      className="inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-600 px-3 text-sm font-bold text-emerald-700"
                    >
                      <MessageCircle className="size-4" aria-hidden />
                      {/* Two cards side by side leave room for the icon only */}
                      <span className="lg:hidden">WhatsApp</span>
                    </a>
                  )}
                  <Link
                    href={`/admin/orders/${order.id}`}
                    aria-label={`Open order ${order.reference}`}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-xl border text-muted-foreground"
                  >
                    <ChevronRight className="size-5" aria-hidden />
                  </Link>
                </div>
              </li>
            ))}
          </ul>

          {/* Wide windows: a table. Two lines per order keep it narrow enough to sit beside the menu */}
          <div className="hidden overflow-x-auto rounded-xl border bg-card shadow-sm xl:block">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead>
                <tr className="admin-table-header">
                  <th className="px-3 py-3.5 pl-4">Order</th>
                  <th className="px-3 py-3.5">Customer</th>
                  <th className="px-3 py-3.5">Phone</th>
                  <th className="px-3 py-3.5">Items</th>
                  <th className="px-3 py-3.5 text-right">Total</th>
                  <th className="px-3 py-3.5">Status</th>
                  <th className="px-3 py-3.5 pr-4" />
                </tr>
              </thead>
              <tbody>
                {rows.map((order) => (
                  <tr key={order.id} className="border-b last:border-0 transition-colors hover:bg-muted/40">
                    <td className="px-3 py-3 pl-4 whitespace-nowrap">
                      <Link href={`/admin/orders/${order.id}`} className="font-mono text-xs font-semibold text-primary hover:underline">
                        {order.reference}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                    </td>
                    <td className="min-w-[9rem] px-3 py-3">
                      <Link href={`/admin/orders/${order.id}`} className="font-medium hover:underline">
                        {order.customerName}
                      </Link>
                      <p className="mt-0.5 text-xs text-muted-foreground">{order.city ?? "—"}</p>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <span className="inline-flex items-center gap-1.5">
                        <a href={`tel:${order.phoneE164 ?? order.phone}`} className="text-primary hover:underline">
                          {formatMoroccanPhone(order.phone)}
                        </a>
                        {order.whatsappUrl && (
                          <a
                            href={order.whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="WhatsApp"
                            aria-label={`WhatsApp ${order.customerName}`}
                            className="rounded-md p-1 text-emerald-700 transition-colors hover:bg-emerald-50"
                          >
                            <MessageCircle className="size-4" aria-hidden />
                          </a>
                        )}
                      </span>
                    </td>
                    <td className="max-w-[220px] px-3 py-3 text-muted-foreground">
                      <span className="line-clamp-2" title={itemsSummary(order.items)}>
                        {itemsSummary(order.items)}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right font-semibold whitespace-nowrap tabular-nums">{formatPrice(order.total)}</td>
                    <td className="px-3 py-3">
                      <StatusBadge status={order.status} />
                    </td>
                    <td className="px-3 py-3 pr-4 text-right">
                      <a
                        href={`/admin/orders/${order.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Print the delivery slip"
                        aria-label={`Print the delivery slip of ${order.reference}`}
                        className="inline-flex rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <Printer className="size-4" aria-hidden />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
            <p>
              Showing {rows.length} of {Math.max(matching, rows.length)} {matching === 1 ? "order" : "orders"}, newest first.
            </p>
            {rows.length < matching && show < MAX_ORDER_LIMIT && (
              <Link
                href={ordersHref({ status: statuses, q, show: Math.min(show + PAGE_SIZE, MAX_ORDER_LIMIT) })}
                scroll={false}
                className="inline-flex h-9 items-center rounded-xl border bg-card px-4 font-semibold text-foreground transition-colors hover:border-primary/40"
              >
                Show more
              </Link>
            )}
          </div>
        </>
      )}
    </div>
  );
}
