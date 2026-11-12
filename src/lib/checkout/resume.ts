import { orderContents, type MetaContent } from "@/lib/analytics/meta-capi";
import { getProductsByIds } from "@/lib/data/products";
import type { OrderTotals } from "@/lib/payments/money";
import { getPayPal } from "@/lib/payments/paypal";
import { settlePayPalOrder } from "@/lib/payments/paypal-settle";
import { canUseStripeCheckout, getStripe } from "@/lib/payments/stripe";
import { ensureOrderPaymentIntent } from "@/lib/payments/stripe-intent";
import { withVariant, type ProductDisplay } from "@/types/product";
import { getCatalogVariant } from "@/config/catalog";
import { countryOf, type CountryCode } from "@/lib/us-address";

import { SESSION_TTL_MS, isOpenOrder } from "./resume-token";
import { findCheckoutToken, issueCheckoutToken } from "./tokens";

const orderReference = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;

/** The shipping details the customer typed, given back only to the holder of the checkout's token. */
export interface ResumeDetails {
  email: string;
  fullName: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: CountryCode;
}

export type ResumeResult =
  /** Nothing to pick up: unknown or expired token, or a canceled order */
  | { status: "none" }
  /** Money is in (or settling). No personal details: just what the thank-you page and the Purchase event need */
  | { status: "paid" | "processing"; orderReference: string; total: number; contents: MetaContent[]; recent: boolean }
  /** Still to pay: everything the payment step needs, without retyping */
  | {
      status: "pending";
      orderId: string;
      orderReference: string;
      totals: OrderTotals;
      details: ResumeDetails;
      items: { product: ProductDisplay; quantity: number }[];
      /** The order's open card PaymentIntent, when it has one, so the card form can load straight away */
      clientSecret: string | null;
    };

export interface ResumeOutcome {
  result: ResumeResult;
  /** The session token the browser holds from now on (a new one after a link was exchanged) */
  sessionToken: string | null;
}

type TokenOrder = NonNullable<Awaited<ReturnType<typeof findCheckoutToken>>>["order"];

/** A payment that landed in the last half hour is the checkout the customer is coming back from. */
const RECENT_MS = 30 * 60 * 1000;

async function paidResult(order: TokenOrder, status: "paid" | "processing", recent: boolean): Promise<ResumeResult> {
  return {
    status,
    orderReference: orderReference(order.id),
    total: order.total,
    contents: await orderContents(order.items),
    recent,
  };
}

function detailsOf(order: TokenOrder): ResumeDetails {
  const address = (order.shippingAddress ?? {}) as Partial<Record<"address1" | "address2" | "city" | "state" | "zip", string>>;
  return {
    email: order.email ?? "",
    fullName: order.customerName,
    phone: order.phone,
    address1: address.address1 ?? "",
    address2: address.address2 ?? "",
    city: address.city ?? "",
    state: address.state ?? "",
    zip: address.zip ?? "",
    country: countryOf(order.shippingAddress as { country?: unknown } | null),
  };
}

/**
 * Finds the checkout a token belongs to and says where it stands. A link
 * token (from a URL) is exchanged for a session token here; a session token
 * is used as it is.
 */
export async function resumeCheckout(input: { session?: string | null; link?: string | null }): Promise<ResumeOutcome> {
  const session = input.session ? await findCheckoutToken(input.session, "session") : null;
  const link = input.link ? await findCheckoutToken(input.link, "link") : null;

  let order: TokenOrder | null = null;
  let sessionToken: string | null = null;
  if (link) {
    order = link.order;
    // The browser already holds this checkout's session (a PayPal return, say): keep it
    sessionToken =
      session && session.orderId === link.orderId && input.session
        ? input.session
        : await issueCheckoutToken(link.orderId, "session", SESSION_TTL_MS);
  } else if (session && input.session) {
    order = session.order;
    sessionToken = input.session;
  }

  if (!order || order.status === "CANCELED") return { result: { status: "none" }, sessionToken: null };

  if (order.paymentStatus === "paid") {
    const recent = Date.now() - order.updatedAt.getTime() < RECENT_MS;
    return { result: await paidResult(order, "paid", recent), sessionToken };
  }
  if (!isOpenOrder(order)) return { result: { status: "none" }, sessionToken: null };

  // A PayPal payment the page never got to finish (the buyer approved, then the
  // in-app browser reloaded or the redirect just came back): capture it now
  if (order.paymentMethod === "paypal" && order.paymentRef && getPayPal()) {
    try {
      const settled = await settlePayPalOrder(order);
      if (settled.status === "paid") return { result: await paidResult(order, "paid", true), sessionToken };
    } catch (err) {
      console.warn("[checkout/resume] couldn't check the PayPal order:", err instanceof Error ? err.message : err);
    }
  }

  // The card intent: reused as it is, brought up to date, or replaced when it can't be used any more
  let clientSecret: string | null = null;
  const stripe = getStripe();
  if (stripe && order.stripePaymentIntentId && (await canUseStripeCheckout())) {
    try {
      const intent = await ensureOrderPaymentIntent(stripe, order);
      if (!intent.ok) {
        // Paid at Stripe; the webhook marks the order paid a moment later
        return { result: await paidResult(order, intent.intentStatus === "succeeded" ? "paid" : "processing", true), sessionToken };
      }
      clientSecret = intent.clientSecret;
    } catch (err) {
      console.warn("[checkout/resume] couldn't read the card intent:", err instanceof Error ? err.message : err);
    }
  }

  const productIds = order.items.flatMap((i) => (i.productId ? [i.productId] : []));
  const products = new Map((await getProductsByIds(productIds)).map((p) => [p.id, p]));
  const items = order.items.flatMap((i) => {
    const product = i.productId ? products.get(i.productId) : undefined;
    if (!product) return [];
    // The line comes back in the colour it was ordered in
    const variant = i.variantKey ? getCatalogVariant(product.slug, i.variantKey) : undefined;
    return [{ product: variant ? withVariant(product, variant) : product, quantity: i.quantity }];
  });
  if (items.length === 0) return { result: { status: "none" }, sessionToken: null };

  return {
    result: {
      status: "pending",
      orderId: order.id,
      orderReference: orderReference(order.id),
      totals: { subtotal: order.subtotal, shippingCost: order.shippingCost, total: order.total },
      details: detailsOf(order),
      items,
      clientSecret,
    },
    sessionToken,
  };
}
