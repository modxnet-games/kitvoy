import Link from "next/link";
import { formatOrderReference, getAllOrders } from "@/lib/data/admin-orders";
import { formatPrice } from "@/lib/formatters";
import { StatusBadge } from "@/components/admin/status-badge";
import { DeleteOrderButton } from "./delete-order-button";

export default async function AdminOrdersPage() {
  const orders = await getAllOrders();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
          Orders
        </h1>
        <p className="mt-1 text-muted-foreground">
          Manage paid orders and fulfillment
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        {orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No orders yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Orders will appear here when customers place them
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="admin-table-header">
                <th className="px-4 py-3.5">Reference</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Phone</th>
                <th className="px-4 py-3.5">Location</th>
                <th className="px-4 py-3.5">Items</th>
                <th className="px-4 py-3.5">Total</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  className="border-b last:border-0 transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-3.5 font-mono text-xs font-medium">
                    {formatOrderReference(order.id)}
                  </td>
                  <td className="px-4 py-3.5 font-medium">
                    {order.customerName}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {order.phone}
                  </td>
                  <td className="max-w-[180px] truncate px-4 py-3.5 text-muted-foreground">
                    {order.location}
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {order.items.reduce(
                      (sum: number, i: { quantity: number }) =>
                        sum + i.quantity,
                      0
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-semibold">
                    {formatPrice(order.total)}
                  </td>
                  <td className="px-4 py-3.5">
                    <StatusBadge status={order.status} />
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3.5">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/admin/orders/${order.id}`}
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/5"
                      >
                        View
                      </Link>
                      <a
                        href={`/admin/orders/${order.id}/print`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="rounded-lg px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                        title="Print order"
                      >
                        🖨️
                      </a>
                      <DeleteOrderButton
                        orderId={order.id}
                        orderReference={formatOrderReference(order.id)}
                        variant="list"
                      />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
