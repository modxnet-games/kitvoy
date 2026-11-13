import { formatSender } from "@/config/mail-senders";
import { formatOrderReference } from "@/lib/data/admin-orders";
import { prisma } from "@/lib/db";
import { buildOrderConfirmationEmail, sendOrderConfirmation, type OrderConfirmationPayload } from "@/lib/email";
import { countryName, countryOf, type ShippingAddress } from "@/lib/us-address";
import { getCatalogProduct } from "@/config/catalog";

export type ConfirmationResult = { sent: true } | { sent: false; reason: string };

/** The database and mail steps, injectable so the send-once rules can be tested without either. */
export interface ConfirmationDeps {
  /** Marks the order's confirmation as taken; false when it was already taken or the order isn't eligible. */
  claim(orderId: string): Promise<boolean>;
  /** Gives the claim back after a failed send so the email can be retried later. */
  release(orderId: string): Promise<void>;
  load(orderId: string): Promise<OrderConfirmationPayload | null>;
  send(payload: OrderConfirmationPayload): Promise<ConfirmationResult>;
  record(orderId: string, payload: OrderConfirmationPayload, result: ConfirmationResult): Promise<void>;
  wait(ms: number): Promise<void>;
}

/** Waits before the second and third tries, so a brief SMTP outage doesn't cost the email. */
export const RETRY_DELAYS_MS = [5_000, 30_000];

/**
 * Sends the order confirmation at most once per order. The claim is a single
 * conditional update, so overlapping calls (a retried capture plus a webhook)
 * can't both send. Never throws; payment capture must not depend on email.
 */
export async function deliverOrderConfirmation(orderId: string, deps: ConfirmationDeps = prismaDeps): Promise<ConfirmationResult> {
  let claimed = false;
  try {
    claimed = await deps.claim(orderId);
    if (!claimed) return { sent: false, reason: "Already sent, or the order isn't paid or has no email" };

    const payload = await deps.load(orderId);
    if (!payload) {
      await deps.release(orderId);
      return { sent: false, reason: "Order not found" };
    }

    let result: ConfirmationResult = await deps.send(payload);
    for (const delay of RETRY_DELAYS_MS) {
      if (result.sent) break;
      await deps.wait(delay);
      result = await deps.send(payload);
    }

    await deps.record(orderId, payload, result).catch((err) => console.error("[orders] Couldn't log the confirmation email:", err));
    if (!result.sent) await deps.release(orderId);
    return result;
  } catch (err) {
    console.error("[orders] Order confirmation email error:", err);
    // Free the claim so a later attempt can still send it
    if (claimed) await deps.release(orderId).catch(() => undefined);
    return { sent: false, reason: err instanceof Error ? err.message : String(err) };
  }
}

function shipToLines(order: { customerName: string; location: string; shippingAddress: unknown }) {
  const address = order.shippingAddress as ShippingAddress | null;
  return address
    ? [
        order.customerName,
        [address.address1, address.address2].filter(Boolean).join(", "),
        [address.city, [address.state, address.zip].filter(Boolean).join(" ")].filter(Boolean).join(", "),
        // The country is named when it isn't the United States
        ...(countryOf(address) === "US" ? [] : [countryName(countryOf(address))]),
      ]
    : [order.customerName, order.location];
}

/**
 * For an order going outside the United States: the country and the days in
 * transit its items were sold with (the slowest item's, from the catalog), so
 * the email repeats what the product page and checkout said.
 */
function deliveryFor(order: { shippingAddress: unknown; items: { productSlug: string }[] }): Pick<OrderConfirmationPayload, "delivery"> {
  const country = countryOf(order.shippingAddress as { country?: unknown } | null);
  if (country === "US") return {};
  const quotes = order.items.flatMap((i) => {
    const days = getCatalogProduct(i.productSlug)?.shipping[country]?.days;
    return days ? [days] : [];
  });
  if (quotes.length === 0) return {};
  return { delivery: { country: countryName(country), days: { min: Math.max(...quotes.map((q) => q.min)), max: Math.max(...quotes.map((q) => q.max)) } } };
}

export const prismaDeps: ConfirmationDeps = {
  async claim(orderId) {
    const { count } = await prisma.order.updateMany({
      where: { id: orderId, paymentStatus: "paid", email: { not: null }, confirmationEmailSentAt: null },
      data: { confirmationEmailSentAt: new Date() },
    });
    return count === 1;
  },
  async release(orderId) {
    await prisma.order.update({ where: { id: orderId }, data: { confirmationEmailSentAt: null } });
  },
  async load(orderId) {
    const order = await prisma.order.findUnique({ where: { id: orderId }, include: { items: true } });
    if (!order?.email) return null;
    return {
      to: order.email,
      customerName: order.customerName,
      orderReference: formatOrderReference(order.id),
      orderDate: order.createdAt,
      items: order.items.map((i) => ({ productName: i.productName, quantity: i.quantity, lineTotal: i.lineTotal })),
      subtotal: order.subtotal,
      shippingCost: order.shippingCost,
      total: order.total,
      paymentMethod: order.paymentMethod,
      shipTo: shipToLines(order),
      ...deliveryFor(order),
    };
  },
  send: sendOrderConfirmation,
  async record(orderId, payload, result) {
    const { subject, text } = buildOrderConfirmationEmail(payload);
    await prisma.sentEmail.create({
      data: {
        fromAddress: formatSender("orders"),
        toAddress: payload.to,
        subject,
        body: text,
        status: result.sent ? "sent" : "failed",
        error: result.sent ? null : result.reason.slice(0, 1000),
        orderId,
      },
    });
  },
  wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
};
