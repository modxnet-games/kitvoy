import { notFound } from "next/navigation";
import Link from "next/link";
import { getOrderById, formatOrderReference } from "@/lib/data/admin-orders";
import { formatPrice } from "@/lib/formatters";
import { StatusBadge } from "@/components/admin/status-badge";
import { OrderStatusForm } from "./order-status-form";
import { DeleteOrderButton } from "../delete-order-button";
import { PrintOrderButton } from "./print-order-button";

interface OrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function AdminOrderPage({ params }: OrderPageProps) {
  const { id } = await params;
  const order = await getOrderById(id);

  if (!order) notFound();

  const orderReference = formatOrderReference(order.id);

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/orders"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to orders
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Order {orderReference}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {new Date(order.createdAt).toLocaleString()} / {order.locale} / {order.currency}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={order.status} />
          <OrderStatusForm
            orderId={order.id}
            currentStatus={order.status}
            disabled={order.status === "DELIVERED" || order.status === "CANCELED"}
          />
          <PrintOrderButton orderId={order.id} />
          <DeleteOrderButton
            orderId={order.id}
            orderReference={orderReference}
            variant="detail"
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold">Order items</h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-3 font-medium">Product</th>
                    <th className="pb-3 font-medium text-right">Qty</th>
                    <th className="pb-3 font-medium text-right">Unit</th>
                    <th className="pb-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-3">
                        <span className="font-medium">{item.productName}</span>
                        <span className="ml-2 text-muted-foreground">({item.productSlug})</span>
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
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between gap-8">
                  <span className="text-muted-foreground">Shipping</span>
                  <span>
                    {order.shippingCost === 0
                      ? "Free"
                      : formatPrice(order.shippingCost)}
                  </span>
                </div>
                <div className="flex justify-between gap-8 font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(order.total)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div>
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold">Customer</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{order.customerName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Phone</dt>
                <dd>
                  <a href={`tel:${order.phone}`} className="text-primary hover:underline">
                    {order.phone}
                  </a>
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Location</dt>
                <dd className="text-muted-foreground">{order.location}</dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
