import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, MessageCircle, Phone, Printer } from "lucide-react";

import { itemsSummary } from "@/components/admin/order-ui";
import { StatusBadge } from "@/components/admin/status-badge";
import { getCatalogVariant } from "@/config/catalog";
import { addressLineOf, getOrderById, serializeOrder } from "@/lib/data/admin-orders";
import { formatDateTime, formatPrice } from "@/lib/formatters";
import { formatMoroccanPhone } from "@/lib/morocco";
import { orderReferenceOf } from "@/lib/order-reference";
import { cn } from "@/lib/utils";
import { DeleteOrderButton } from "../delete-order-button";
import { OrderCustomerForm, OrderNotesForm } from "./order-edit-forms";
import { OrderStatusPanel } from "./order-status-panel";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: OrderPageProps): Promise<Metadata> {
  const { id } = await params;
  return { title: `Order ${orderReferenceOf(id)}` };
}

const LANGUAGES: Record<string, string> = { ar: "Arabic", fr: "French", en: "English" };

/** What the total means for the cash, by status: still to collect, collected, or lost. */
function cashLine(status: string): { label: string; tone: string; struck?: boolean } {
  if (status === "DELIVERED") return { label: "Cash collected", tone: "border-emerald-200 bg-emerald-50 text-emerald-900" };
  if (status === "CANCELED") return { label: "Canceled: nothing to collect", tone: "border-border bg-muted/50 text-muted-foreground", struck: true };
  if (status === "RETURNED") return { label: "Returned: nothing collected", tone: "border-border bg-muted/50 text-muted-foreground", struck: true };
  return { label: "Cash to collect", tone: "border-primary/30 bg-primary/5 text-foreground" };
}

export default async function AdminOrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const row = await getOrderById(id);
  if (!row) notFound();

  const order = serializeOrder(row);
  const address = addressLineOf(row);
  const cash = cashLine(order.status);
  const pieces = `${order.itemsCount} ${order.itemsCount === 1 ? "piece" : "pieces"}`;

  const timeline: [string, Date | null][] = [
    ["Placed", order.createdAt],
    ["Confirmed", order.confirmedAt],
    ["Shipped", order.shippedAt],
    ["Delivered", order.deliveredAt],
  ];
  const utm: [string, string | null][] = [
    ["Source", order.utmSource],
    ["Medium", order.utmMedium],
    ["Campaign", order.utmCampaign],
    ["Ad (content)", order.utmContent],
    ["Term", order.utmTerm],
  ];
  const hasAttribution = utm.some(([, value]) => value) || !!order.fbclid;

  // Deleting gives back the pieces an order still holds; for a delivered order that is worth saying
  const deleteConsequence = !order.stockHeld
    ? undefined
    : order.status === "DELIVERED"
      ? `It was delivered: its ${pieces} will go back in stock and its ${formatPrice(order.total)} will leave the sales figures.`
      : `Its ${pieces} will go back in stock.`;

  return (
    <div>
      <Link href="/admin/orders" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden />
        Back to orders
      </Link>
      <div className="mt-3 mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Order {order.reference}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Placed {formatDateTime(order.createdAt)} · ordered in {LANGUAGES[order.locale] ?? order.locale}
          </p>
        </div>
        <StatusBadge status={order.status} size="lg" />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* Everything the confirmation call needs, then the buttons for its outcome */}
          <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
              <div className="min-w-0">
                <p className="text-lg font-semibold">{order.customerName}</p>
                <p className="text-sm text-muted-foreground" dir="auto">
                  {order.location}
                </p>
              </div>
              {/* On a phone: one line under the address, the amount at the right. Wider: a block in the corner */}
              <div className="flex w-full items-baseline justify-between gap-3 sm:w-auto sm:flex-col sm:items-end sm:gap-0">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{cash.label}</p>
                <p className={cn("text-2xl font-bold tabular-nums", cash.struck && "text-muted-foreground line-through")}>{formatPrice(order.total)}</p>
              </div>
            </div>
            <p className="mt-2 text-sm">{itemsSummary(order.items)}</p>

            <div className="mt-4 flex flex-wrap gap-2">
              <a
                href={`tel:${order.phoneE164 ?? order.phone}`}
                className="inline-flex h-12 min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 sm:h-11 sm:flex-none"
              >
                <Phone className="size-4 shrink-0" aria-hidden />
                <span className="truncate">Call {formatMoroccanPhone(order.phone)}</span>
              </a>
              {order.whatsappUrl && (
                <a
                  href={order.whatsappUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-600 px-4 text-sm font-bold text-emerald-700 transition-colors hover:bg-emerald-50 sm:h-11"
                >
                  <MessageCircle className="size-4" aria-hidden />
                  WhatsApp
                </a>
              )}
            </div>

            <div className="mt-5 border-t pt-5">
              <OrderStatusPanel orderId={order.id} status={order.status} stockHeld={order.stockHeld} />
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="font-semibold">Items</h2>
            <ul className="mt-3 divide-y">
              {order.items.map((item) => {
                const variant = getCatalogVariant(item.productSlug, item.variantKey);
                return (
                  <li key={item.id} className="flex items-start justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="font-medium">{item.productName}</p>
                      {variant ? (
                        <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs text-muted-foreground">
                          <span
                            className="inline-block size-3.5 rounded-full border border-black/15"
                            style={{ backgroundColor: variant.colour.swatch }}
                            aria-hidden
                          />
                          <span>
                            {variant.colour.label.fr} · size {variant.size}
                          </span>
                          <span className="font-mono">{variant.sku}</span>
                        </p>
                      ) : (
                        item.variantKey && <p className="mt-1 font-mono text-xs text-muted-foreground">{item.variantKey}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="font-semibold tabular-nums">{formatPrice(item.lineTotal)}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {item.quantity} × {formatPrice(item.unitPrice)}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>

            <dl className="mt-1 space-y-1.5 border-t pt-4 text-sm">
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Subtotal ({pieces})</dt>
                <dd className="tabular-nums">{formatPrice(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-8">
                <dt className="text-muted-foreground">Delivery</dt>
                <dd className="tabular-nums">{order.shippingCost === 0 ? "Free" : formatPrice(order.shippingCost)}</dd>
              </div>
            </dl>
            <div className={cn("mt-4 flex items-center justify-between gap-4 rounded-xl border px-4 py-3", cash.tone)}>
              <span className="font-semibold">{cash.label}</span>
              <span className={cn("text-xl font-bold tabular-nums", cash.struck && "line-through")}>{formatPrice(order.total)}</span>
            </div>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="mb-3 font-semibold">Note and tracking</h2>
            <OrderNotesForm orderId={order.id} adminNote={order.adminNote ?? ""} trackingNumber={order.trackingNumber ?? ""} />
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="mb-3 font-semibold">Customer</h2>
            <OrderCustomerForm orderId={order.id} customerName={order.customerName} phone={order.phone} city={order.city ?? ""} address={address} />
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="font-semibold">Timeline</h2>
            <dl className="mt-3 space-y-2 text-sm">
              {timeline.map(([label, at]) => (
                <div key={label} className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">{label}</dt>
                  <dd className={cn("text-right tabular-nums", !at && "text-muted-foreground")}>{at ? formatDateTime(at) : "—"}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">Morocco time.</p>
          </section>

          <section className="rounded-xl border bg-card p-4 shadow-sm sm:p-6">
            <h2 className="font-semibold">Attribution</h2>
            {hasAttribution ? (
              <dl className="mt-3 space-y-3 text-sm">
                {utm
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label}>
                      <dt className="text-muted-foreground">{label}</dt>
                      <dd className="font-medium break-all">{value}</dd>
                    </div>
                  ))}
                {order.fbclid && (
                  <div>
                    <dt className="text-muted-foreground">Meta click</dt>
                    <dd className="text-xs text-muted-foreground">Arrived from a Meta ad (fbclid recorded)</dd>
                  </div>
                )}
                {order.metaPurchaseSentAt && (
                  <div>
                    <dt className="text-muted-foreground">Meta Purchase (server)</dt>
                    <dd className="text-xs text-muted-foreground">Sent {formatDateTime(order.metaPurchaseSentAt)}</dd>
                  </div>
                )}
              </dl>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No ad parameters on this visit (direct, search or a link without UTM tags).</p>
            )}
          </section>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <a
          href={`/admin/orders/${order.id}/print`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-10 items-center gap-2 rounded-xl border border-primary bg-transparent px-4 text-sm font-bold text-primary shadow-sm transition-all hover:bg-primary hover:text-primary-foreground active:scale-[0.98]"
        >
          <Printer className="size-4" aria-hidden />
          Print delivery slip
        </a>
        <DeleteOrderButton orderId={order.id} orderReference={order.reference} consequence={deleteConsequence} />
      </div>
    </div>
  );
}
