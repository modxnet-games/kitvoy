import type { Prisma } from "@prisma/client";

import { isCjSandbox } from "@/config/fulfillment";
import { formatOrderReference, updateOrderFulfillment } from "@/lib/data/admin-orders";
import { prisma } from "@/lib/db";
import type { ShippingAddress } from "@/lib/us-address";
import { CJ_CODES, CjError, cjRequest, describeCjError, getCjBalance, getCjOrder, payCjOrder } from "./cj-client";
import { buildCjOrderPayload, CJ_PAID_STATUSES, CJ_UNPAID_STATUSES } from "./cj-order";
import { emailCustomerIfShipped, type CustomerEmailResult } from "./shipping-email";

/** supplierStatus for CJ sandbox orders, which are never paid or shipped. */
export const CJ_SANDBOX_STATUS = "SANDBOX";

export type CjSendResult =
  | { ok: true; cjOrderId: string; status: string }
  | { ok: false; error: string };

function saveState(orderId: string, data: Prisma.OrderUpdateInput) {
  return prisma.order.update({ where: { id: orderId }, data });
}

/**
 * Creates a paid order in CJ and pays it from the CJ balance. Safe to call
 * again (admin Retry): an order already in CJ is picked up, not duplicated,
 * and only paid if CJ still shows it unpaid. Problems are saved on the order
 * as fulfillmentError so the admin can finish it by hand.
 */
export async function sendOrderToCj(orderId: string): Promise<CjSendResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
  if (!order) return { ok: false, error: "Order not found" };
  if (order.paymentStatus !== "paid") return { ok: false, error: "Only paid orders can be sent to CJ" };
  if (order.status === "CANCELED") return { ok: false, error: "This order is canceled" };

  const sandbox = isCjSandbox();
  try {
    let cjOrderId = order.fulfillmentRef;
    let status = order.supplierStatus ?? "CREATED";

    if (!cjOrderId) {
      // With no balance, only create the order so it's waiting in CJ to be paid
      const payType = sandbox || (await getCjBalance()) <= 0 ? 3 : 2;
      const built = buildCjOrderPayload(
        {
          id: order.id,
          reference: formatOrderReference(order.id),
          customerName: order.customerName,
          email: order.email,
          phone: order.phone,
          total: order.total,
          shippingAddress: order.shippingAddress as unknown as ShippingAddress | null,
          items: order.items,
        },
        { payType, sandbox },
      );
      if (!built.ok) {
        await saveState(order.id, { fulfillmentError: built.error });
        return { ok: false, error: built.error };
      }

      try {
        const created = await cjRequest<{ orderId: string; orderStatus?: string }>(
          "POST",
          "/shopping/order/createOrderV2",
          built.payload,
        );
        // Create answers with a shipment code; the detail carries CJ's own order id
        const detail = await getCjOrder(created.orderId).catch(() => null);
        cjOrderId = detail?.orderId ?? created.orderId;
        status = detail?.orderStatus ?? created.orderStatus ?? status;
      } catch (err) {
        // Already created (a retry after a timeout, or created but not paid):
        // pick the existing CJ order up by our order number
        const recoverable =
          err instanceof CjError && (err.code === CJ_CODES.ORDER_EXISTS || err.code === CJ_CODES.BALANCE_INSUFFICIENT);
        const existing = recoverable ? await getCjOrder(order.id) : null;
        if (!existing) throw err;
        cjOrderId = existing.orderId;
        status = existing.orderStatus ?? status;
      }
      await saveState(order.id, {
        fulfillmentRef: cjOrderId,
        supplierStatus: sandbox ? CJ_SANDBOX_STATUS : status,
        fulfillmentError: null,
      });
    }

    if (sandbox) return { ok: true, cjOrderId, status: CJ_SANDBOX_STATUS };

    if (CJ_UNPAID_STATUSES.has(status)) {
      try {
        await payCjOrder(cjOrderId);
      } catch (err) {
        const error = `${describeCjError(err)}. The order is waiting in CJ: top up the CJ balance and press Retry, or pay it in the CJ dashboard.`;
        await saveState(order.id, { supplierStatus: status, fulfillmentError: error });
        return { ok: false, error };
      }
      status = (await getCjOrder(cjOrderId))?.orderStatus ?? "UNSHIPPED";
    }

    await saveState(order.id, {
      supplierStatus: status,
      fulfillmentError: null,
      ...(CJ_PAID_STATUSES.has(status) && order.status === "CONFIRMED" ? { status: "PREPARING" } : {}),
    });
    return { ok: true, cjOrderId, status };
  } catch (err) {
    const error = describeCjError(err);
    await saveState(order.id, { fulfillmentError: error }).catch(() => undefined);
    return { ok: false, error };
  }
}

export interface CjSyncOrderResult {
  orderId: string;
  status?: string;
  shipped: boolean;
  delivered: boolean;
  customerEmail: CustomerEmailResult;
  error?: string;
}

/**
 * Pulls one order's status and tracking number from CJ. A new tracking number
 * marks the order Shipped and emails the customer; CJ's DELIVERED marks it
 * Delivered.
 */
export async function syncCjOrder(orderId: string): Promise<CjSyncOrderResult> {
  const result: CjSyncOrderResult = { orderId, shipped: false, delivered: false, customerEmail: null };
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order?.fulfillmentRef) return { ...result, error: "This order hasn't been sent to CJ" };
  if (order.supplierStatus === CJ_SANDBOX_STATUS) return { ...result, status: CJ_SANDBOX_STATUS };

  try {
    const detail = await getCjOrder(order.fulfillmentRef);
    if (!detail) {
      const error = "CJ can't find this order";
      await saveState(order.id, { fulfillmentError: error });
      return { ...result, error };
    }
    const status = detail.orderStatus ?? order.supplierStatus ?? undefined;
    result.status = status;

    let fulfillmentError = order.fulfillmentError;
    if (status === "CANCELLED") fulfillmentError = "CJ canceled this order. Fulfill it by hand.";
    else if (status && CJ_PAID_STATUSES.has(status)) fulfillmentError = null; // e.g. paid in the CJ dashboard
    await saveState(order.id, {
      supplierStatus: status ?? null,
      fulfillmentError,
      ...(status && CJ_PAID_STATUSES.has(status) && order.status === "CONFIRMED" ? { status: "PREPARING" } : {}),
    });

    const tracking = detail.trackNumber?.trim();
    const newTracking =
      tracking &&
      (order.fulfillmentStatus === "UNFULFILLED" ||
        (order.fulfillmentStatus === "SHIPPED" && tracking !== order.trackingNumber));
    if (newTracking) {
      const update = await updateOrderFulfillment(order.id, {
        fulfillmentStatus: order.fulfillmentStatus === "UNFULFILLED" ? "SHIPPED" : undefined,
        trackingNumber: tracking,
      });
      if (!update.ok) return { ...result, error: update.error };
      result.shipped = true;
      result.customerEmail = await emailCustomerIfShipped(order.id, update.previous);
    }

    if (status === "DELIVERED" && (newTracking || order.fulfillmentStatus === "SHIPPED")) {
      const update = await updateOrderFulfillment(order.id, { fulfillmentStatus: "DELIVERED" });
      result.delivered = update.ok;
    }
    return result;
  } catch (err) {
    return { ...result, error: describeCjError(err) };
  }
}

/** Orders sent to CJ that haven't been delivered yet. */
export async function syncCjTracking(limit = 50) {
  const orders = await prisma.order.findMany({
    where: {
      paymentStatus: "paid",
      status: { not: "CANCELED" },
      fulfillmentRef: { not: null },
      fulfillmentStatus: { in: ["UNFULFILLED", "SHIPPED"] },
      // `not` alone would also skip orders with no supplier status yet
      OR: [{ supplierStatus: null }, { supplierStatus: { not: CJ_SANDBOX_STATUS } }],
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true },
  });

  const results: CjSyncOrderResult[] = [];
  for (const { id } of orders) results.push(await syncCjOrder(id));
  return {
    checked: results.length,
    shipped: results.filter((r) => r.shipped).length,
    delivered: results.filter((r) => r.delivered).length,
    emailed: results.filter((r) => r.customerEmail?.sent).length,
    errors: results.filter((r) => r.error).map((r) => `${formatOrderReference(r.orderId)}: ${r.error}`),
  };
}
