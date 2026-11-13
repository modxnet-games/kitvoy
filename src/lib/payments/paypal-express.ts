/**
 * PayPal express checkout: the buyer pays from the top of the details step
 * and PayPal supplies the name, email and shipping address.
 *
 * No store order exists until the buyer has approved. The id the order will
 * have is chosen when the PayPal order is opened and written into it
 * (custom_id), so the one path to "paid" (settlePayPalOrder) can check, as it
 * does for every PayPal payment, that the PayPal order was opened for exactly
 * this order and this total. A buyer who approves and never comes back is not
 * charged: the PayPal order lapses uncaptured.
 *
 * The cart is written into the PayPal order as well (one item per line), so
 * completing reads it back from PayPal instead of trusting the browser to
 * still hold it: in Meta's in-app browsers the whole page goes to PayPal and
 * comes back, and the web view may have dropped the cart meanwhile.
 *
 * Everything here takes what it does to the outside world (PayPal, the
 * database) as `deps`, so the rules can be tested without either.
 */
import { randomInt } from "node:crypto";

import type { MetaContent } from "@/lib/analytics/meta-capi";
import { checkExpressDetails, detailsFromPayPal, paypalAddressReason, sameTotal, type PayPalAddressReason } from "@/lib/checkout/express-details";
import { isOpenOrder } from "@/lib/checkout/resume-constants";
import { cartItemOf, type CartItemPayload, type PriceCartResult, type PricedOrder } from "@/lib/orders";
import { toCents } from "@/lib/payments/money";
import { EXPRESS_RETURN_PARAM, PAYPAL_EXPRESS_REFERENCE, PAYPAL_ID_RE, STORE_ID_RE } from "@/lib/payments/paypal-ids";
import type { PayPalItem, PayPalOrder, SettleOrder, SettleResult } from "@/lib/payments/paypal-settle";
import type { CheckoutDetails } from "@/lib/us-address";

/** Express PayPal is on unless PAYPAL_EXPRESS=off: a switch that needs an env change and a restart, not a release. */
export function paypalExpressEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.PAYPAL_EXPRESS?.trim().toLowerCase() !== "off";
}

const orderReference = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;

const ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

/**
 * An id for an order that doesn't exist yet, in the shape of the ones the
 * database gives out (a cuid: "c" and 24 lower-case letters and digits), so
 * the order reference and every id check read it like any other.
 */
export function newOrderId(): string {
  let id = "c";
  for (let i = 0; i < 24; i++) id += ID_ALPHABET[randomInt(ID_ALPHABET.length)];
  return id;
}

/** A PayPal amount in cents; null unless it is US dollars written as PayPal writes them ("59.99"). */
export function paypalAmountCents(amount: { value?: string; currency_code?: string } | null | undefined): number | null {
  if (!amount || amount.currency_code !== "USD" || typeof amount.value !== "string") return null;
  const match = /^(\d{1,7})\.(\d{2})$/.exec(amount.value);
  return match ? Number(match[1]) * 100 + Number(match[2]) : null;
}

/* ---------- the cart, recorded in the PayPal order ---------- */

/** What one PayPal item says about the cart: which product, in which colour (null when it has no choice of colour), how many. */
export interface CartSkuLine {
  productId: string;
  variantKey: string | null;
  quantity: number;
}

const SKU_PRODUCT_RE = /^[A-Za-z0-9_-]{1,64}$/;
const SKU_VARIANT_RE = /^[a-z0-9-]{1,40}$/;
const SKU_QUANTITY_RE = /^[1-9]\d{0,3}$/;
/** PayPal's limit for an item's name and for its sku. */
const PAYPAL_TEXT_MAX = 127;
/** More lines than any cart has; a PayPal order listing more was not written by the store. */
const MAX_CART_LINES = 50;

/** A cart line as a PayPal item's sku: "<productId>|<variantKey or empty>|<quantity>". */
export function encodeCartSku(line: CartSkuLine): string {
  return `${line.productId}|${line.variantKey ?? ""}|${line.quantity}`;
}

/**
 * The cart line a sku stands for, or null for anything `encodeCartSku`
 * wouldn't have written: a missing or extra part, an id or colour with other
 * characters, a quantity that isn't a plain whole number from 1 to 9999.
 */
export function decodeCartSku(sku: unknown): CartSkuLine | null {
  if (typeof sku !== "string" || sku.length > PAYPAL_TEXT_MAX) return null;
  const parts = sku.split("|");
  if (parts.length !== 3) return null;
  const [productId, variantKey, quantity] = parts;
  if (!SKU_PRODUCT_RE.test(productId) || !SKU_QUANTITY_RE.test(quantity)) return null;
  if (variantKey !== "" && !SKU_VARIANT_RE.test(variantKey)) return null;
  return { productId, variantKey: variantKey || null, quantity: Number(quantity) };
}

const usd = (cents: number) => ({ currency_code: "USD", value: (cents / 100).toFixed(2) });

/**
 * The priced cart as PayPal items: one per line, always with quantity 1 and
 * the line's own total as its price, because a bundle's price doesn't divide
 * evenly by its quantity. The real quantity is in the name the buyer sees
 * ("3 × PouncePop (Blue)") and in the sku the store reads back.
 *
 * Null when a line can't be written as a sku that reads back as itself: the
 * PayPal order then carries no items at all, and completing prices the cart
 * the browser sends, as it does for any PayPal order without them.
 */
export function expressCartItems(priced: PricedOrder) {
  const items = priced.items.map((line) => {
    const sku = encodeCartSku(line);
    const back = decodeCartSku(sku);
    if (!back || back.productId !== line.productId || back.variantKey !== line.variantKey || back.quantity !== line.quantity) return null;
    return {
      name: `${line.quantity} × ${line.productName}`.slice(0, PAYPAL_TEXT_MAX),
      sku,
      quantity: "1",
      unit_amount: usd(toCents(line.lineTotal)),
      category: "PHYSICAL_GOODS" as const,
    };
  });
  const written = items.filter((item) => item !== null);
  return written.length === items.length && written.length > 0 && written.length <= MAX_CART_LINES ? written : null;
}

/**
 * The cart a PayPal order was opened for, read back from its items.
 *
 * - `{ ok: true, items: null }`: the PayPal order lists no items (it was
 *   opened without them), so there is nothing to read.
 * - `{ ok: false }`: it lists items, but not as the store writes them (a sku
 *   that doesn't decode, the same product and colour twice, too many lines).
 *   Such an order is refused: its cart is never guessed at.
 *
 * Only ids, colours and quantities are taken from here. What they cost is
 * read from the database again by whoever uses the result.
 */
export function cartFromPayPalItems(items: PayPalItem[] | null | undefined): { ok: true; items: CartItemPayload[] | null } | { ok: false } {
  if (items === undefined || items === null) return { ok: true, items: null };
  if (!Array.isArray(items)) return { ok: false };
  if (items.length === 0) return { ok: true, items: null };
  if (items.length > MAX_CART_LINES) return { ok: false };
  const seen = new Set<string>();
  const cart: CartItemPayload[] = [];
  for (const item of items) {
    const line = decodeCartSku(item?.sku);
    if (!line) return { ok: false };
    const key = `${line.productId}|${line.variantKey ?? ""}`;
    if (seen.has(key)) return { ok: false };
    seen.add(key);
    cart.push(cartItemOf(line));
  }
  return { ok: true, items: cart };
}

/* ---------- the PayPal order itself ---------- */

/**
 * The return and cancel addresses of a redirect payment, on the store's own
 * origin (`siteUrl`). Neither carries a token: PayPal adds its order id, and
 * the browser that left holds the matching marker.
 */
export function expressReturnUrls(siteUrl: string): { returnUrl: string; cancelUrl: string } {
  const back = `${siteUrl.replace(/\/$/, "")}/checkout?${EXPRESS_RETURN_PARAM}=`;
  return { returnUrl: `${back}return`, cancelUrl: `${back}cancel` };
}

type PayPalLink = { rel?: unknown; href?: unknown };

/** The page where the buyer approves a PayPal order, from the links PayPal returned with it; null unless it is on paypal.com. */
export function paypalApproveUrl(links: unknown): string | null {
  if (!Array.isArray(links)) return null;
  const link = (links as (PayPalLink | null)[]).find((l) => l?.rel === "approve" || l?.rel === "payer-action");
  const href = link?.href;
  return typeof href === "string" && /^https:\/\/([a-z0-9-]+\.)*paypal\.com\//.test(href) ? href : null;
}

/**
 * The PayPal order an express checkout opens: one payment for the cart's
 * total, for the store order with this id. PayPal shows the buyer their own
 * addresses to choose from; the store checks the chosen one after approval.
 *
 * The cart is listed in it, with a breakdown PayPal checks against the total
 * (items plus shipping). `redirect` adds the addresses PayPal sends the buyer
 * back to when the whole page goes to PayPal instead of a pop-up.
 */
export function expressOrderBody(input: { orderId: string; priced: PricedOrder; brandName: string; redirect?: { returnUrl: string; cancelUrl: string } | null }) {
  const { priced } = input;
  const items = expressCartItems(priced);
  const totalCents = toCents(priced.total);
  const itemCents = priced.items.reduce((sum, line) => sum + toCents(line.lineTotal), 0);
  const shippingCents = totalCents - itemCents;
  // PayPal refuses a breakdown that doesn't add up to the total, so the cart is only listed when it does
  const listed = items !== null && shippingCents >= 0;
  return {
    intent: "CAPTURE" as const,
    purchase_units: [
      {
        reference_id: PAYPAL_EXPRESS_REFERENCE,
        custom_id: input.orderId,
        description: `${input.brandName} order ${orderReference(input.orderId)}`,
        amount: {
          ...usd(totalCents),
          ...(listed && { breakdown: { item_total: usd(itemCents), ...(shippingCents > 0 && { shipping: usd(shippingCents) }) } }),
        },
        ...(listed && { items }),
      },
    ],
    application_context: {
      brand_name: input.brandName,
      shipping_preference: "GET_FROM_FILE" as const,
      user_action: "PAY_NOW" as const,
      ...(input.redirect && { return_url: input.redirect.returnUrl, cancel_url: input.redirect.cancelUrl }),
    },
  };
}

/* ---------- opening the PayPal order ---------- */

export type ExpressCreateResult =
  /** `approveUrl`: PayPal's approval page, when the whole page is to go there (redirect mode) */
  | { ok: true; paypalOrderId: string; allowedCountries: string[]; approveUrl?: string }
  | { ok: false; error: string; status: number };

export interface ExpressCreateDeps {
  /** Stock and prices from the database, and the countries the cart ships to */
  priceCart(items: CartItemPayload[]): Promise<PriceCartResult>;
  /** The open order of the checkout this browser already started, when it presented that checkout's session token */
  sessionOrder(): Promise<{ id: string; stripePaymentIntentId: string | null } | null>;
  cardPaymentInProgress(paymentIntentId: string | null): Promise<boolean>;
  newOrderId(): string;
  /**
   * Opens the PayPal order for this store order id and priced cart, and
   * returns PayPal's id for it with the links PayPal gave (its approval page
   * is among them). `redirect`: PayPal is to send the buyer back to the store.
   */
  openPayPalOrder(input: { orderId: string; priced: PricedOrder; redirect: boolean }): Promise<{ id: string; links?: unknown }>;
}

/**
 * Opens a PayPal order for the cart as the database prices it. Nothing is
 * saved: the store order is created only once the buyer has approved.
 *
 * A checkout that already has an open order (the buyer saved their details,
 * then came back to this step) keeps it: the PayPal order is opened for that
 * order's id, so the checkout still ends with one order.
 *
 * `redirect` is for Meta's in-app browsers, where a pop-up loses its page:
 * the answer then carries PayPal's approval page for the browser to go to.
 */
export async function createExpressOrder(items: CartItemPayload[], deps: ExpressCreateDeps, options: { redirect?: boolean } = {}): Promise<ExpressCreateResult> {
  if (items.length === 0) return { ok: false, error: "EMPTY_CART", status: 400 };

  const pricing = await deps.priceCart(items);
  if (!pricing.ok) return { ok: false, error: pricing.failure.errorKey ?? pricing.failure.error, status: 400 };
  if (!(pricing.priced.total > 0)) return { ok: false, error: "order.errorGeneric", status: 400 };
  if (pricing.allowedCountries.length === 0) return { ok: false, error: "order.errorCountryUnavailable", status: 400 };

  const open = await deps.sessionOrder();
  // A card payment for this checkout is already settling: don't open a second way to pay
  if (open && (await deps.cardPaymentInProgress(open.stripePaymentIntentId))) {
    return { ok: false, error: "checkout.paymentInProgress", status: 409 };
  }

  const orderId = open && STORE_ID_RE.test(open.id) ? open.id : deps.newOrderId();
  const redirect = options.redirect === true;
  const opened = await deps.openPayPalOrder({ orderId, priced: pricing.priced, redirect });
  if (!PAYPAL_ID_RE.test(opened.id)) return { ok: false, error: "PAYMENT_INIT_FAILED", status: 502 };
  if (!redirect) return { ok: true, paypalOrderId: opened.id, allowedCountries: pricing.allowedCountries };

  const approveUrl = paypalApproveUrl(opened.links);
  if (!approveUrl) {
    console.error("[checkout/paypal-express] PayPal returned no approval link for", opened.id);
    return { ok: false, error: "PAYMENT_INIT_FAILED", status: 502 };
  }
  return { ok: true, paypalOrderId: opened.id, allowedCountries: pricing.allowedCountries, approveUrl };
}

/* ---------- completing it once the buyer has approved ---------- */

/**
 * How an approved express payment ended. Only "paid" says anything about the
 * order, and nothing here is personal: the buyer's details never travel back
 * to the browser.
 *
 * "address_unusable", "price_changed" and "not_completed" all tell the buyer
 * they were not charged. They are only answered when that is known, and it is
 * then made to stay true: the store order stops naming the PayPal order, so
 * nothing can capture it later. Whenever money may have moved or may still
 * move, the answer is "unconfirmed" and nothing is claimed either way.
 */
export type ExpressCompleteResult =
  | { status: "paid"; orderReference: string; total: number; contents: MetaContent[] }
  /** PayPal's address can't be shipped to; nothing was saved or captured */
  | { status: "address_unusable"; reason: PayPalAddressReason }
  /** PayPal shared no usable phone number; the same call with a `phone` finishes the order */
  | { status: "needs_phone" }
  /** The cart is priced differently now than when the buyer approved; nothing was captured */
  | { status: "price_changed" }
  /** Nothing was taken and nothing will be. `code` is a short reason for the logs, never shown to the buyer */
  | { status: "not_completed"; code: string }
  /** Whether the buyer has paid, or is about to, isn't known here (a capture PayPal is holding, a card payment settling) */
  | { status: "unconfirmed"; code: string };

/** The answers that tell the buyer nothing was charged. */
const SAYS_NOT_CHARGED: ReadonlySet<ExpressCompleteResult["status"]> = new Set(["address_unusable", "price_changed", "not_completed"]);

/**
 * True when PayPal answered a call with a refusal (a 4xx: a declined funding
 * source, an order that can't be captured). A timeout, a dropped connection
 * or a 5xx is not one: the call may still have gone through.
 */
function isPayPalRefusal(err: unknown): boolean {
  const e = err as { statusCode?: unknown; message?: unknown } | null;
  const status = e?.statusCode;
  // A 409 is a conflict, not a refusal: another request may be taking the payment right now
  if (typeof status !== "number" || status < 400 || status >= 500 || status === 409) return false;
  // The same capture (same request id) is still running for another request, so it may yet go through
  return !(typeof e?.message === "string" && e.message.includes("PREVIOUS_REQUEST_IN_PROGRESS"));
}

/** The store order as completing reads it. */
export type ExpressStoreOrder = SettleOrder & { status: string };

export interface ExpressCompleteDeps {
  /** The PayPal order as PayPal has it now, read with the store's credentials; null when it no longer exists */
  getPayPalOrder(paypalOrderId: string): Promise<PayPalOrder | null>;
  findOrder(orderId: string): Promise<ExpressStoreOrder | null>;
  priceCart(items: CartItemPayload[]): Promise<PriceCartResult>;
  /**
   * Saves the buyer's details as the store order with this id (a new order,
   * or the checkout's open order brought up to date), records the PayPal
   * order on it, and returns the order as it now stands.
   */
  saveOrder(input: { orderId: string; paypalOrderId: string; details: CheckoutDetails; items: CartItemPayload[] }): Promise<{ ok: true; order: ExpressStoreOrder } | { ok: false; error: string }>;
  /** True when the order's card PaymentIntent is paid or settling */
  cardPaymentInProgress(paymentIntentId: string | null): Promise<boolean>;
  /** The one path to "paid" for PayPal (settlePayPalOrder) */
  settle(order: SettleOrder, paypalOrderId: string): Promise<SettleResult>;
  /** Drops this PayPal order from the store order, so no notification or reload can capture it later */
  forget(orderId: string, paypalOrderId: string): Promise<void>;
  /** What was bought, for the Purchase event */
  contents(orderId: string): Promise<MetaContent[]>;
}

/**
 * Turns a PayPal order the buyer approved into a paid store order, or says
 * why not. Nothing from the browser is trusted beyond the PayPal order's id:
 * the buyer, the address, the amount and the cart are read from PayPal with
 * the store's own credentials. `items`, the cart the browser sends, is only
 * priced for a PayPal order that lists none; one whose items can't be read
 * back as a cart is refused. Either way the cart is priced from the database
 * again, and a total that isn't the amount the buyer approved takes nothing.
 *
 * The checks run in a fixed order, and the store order is saved only after
 * all of them pass, so a refusal never leaves an order or a charge behind:
 * a card payment already settling, then the address, the phone, the price,
 * then save, then settle. Safe to repeat: a second call for an order that is
 * already paid answers "paid" again and touches nothing.
 *
 * What the buyer is told follows what is known. "Not charged" (see
 * ExpressCompleteResult) is answered only when PayPal took nothing, and the
 * store order then stops naming the PayPal order so that stays true. A
 * capture PayPal is holding, a capture that may or may not have gone through,
 * or a card payment settling on the same order is answered "unconfirmed".
 */
export async function completeExpressOrder(
  input: { paypalOrderId: unknown; items: CartItemPayload[]; phone?: unknown },
  deps: ExpressCompleteDeps,
): Promise<ExpressCompleteResult> {
  const notCompleted = (code: string): ExpressCompleteResult => ({ status: "not_completed", code });
  const unconfirmed = (code: string): ExpressCompleteResult => ({ status: "unconfirmed", code });
  const paid = async (order: ExpressStoreOrder): Promise<ExpressCompleteResult> => ({
    status: "paid",
    orderReference: orderReference(order.id),
    total: order.total,
    contents: await deps.contents(order.id),
  });

  if (typeof input.paypalOrderId !== "string" || !PAYPAL_ID_RE.test(input.paypalOrderId)) return notCompleted("invalid_id");
  const paypalOrderId = input.paypalOrderId;
  // The store order that names this PayPal order, once one is known to: it is what a notification or a reload would capture
  let named: string | null = null;
  const forget = async () => {
    if (named) await deps.forget(named, paypalOrderId);
    named = null;
  };

  const settle = async (order: ExpressStoreOrder): Promise<ExpressCompleteResult> => {
    let settled: SettleResult;
    try {
      settled = await deps.settle(order, paypalOrderId);
    } catch (err) {
      // Only a refusal from PayPal that leaves the order approved and uncaptured says nothing was taken.
      // Anything else (a timeout, a 5xx, PayPal showing the capture after all) says nothing either way:
      // the error stands, nothing is claimed, and the order keeps naming the PayPal order
      if (!isPayPalRefusal(err)) throw err;
      const now = await deps.getPayPalOrder(paypalOrderId).catch(() => undefined);
      if (now?.status !== "APPROVED") throw err;
      console.error(`[checkout/paypal-express] ${orderReference(order.id)}: capture refused, nothing taken:`, err instanceof Error ? err.message : err);
      return notCompleted("capture_failed");
    }
    if (settled.status === "paid") return paid(order);
    switch (settled.reason) {
      // PayPal is holding the capture, took it and is giving it back, or left it in a state that isn't known:
      // the order keeps naming the PayPal order, so a capture that clears later still finds it
      case "capture_pending":
      case "order_changed":
      case "not_completed":
        return unconfirmed(`settle_${settled.reason}`);
      // PayPal took nothing and now never will, but the card payment may still charge the buyer
      case "card_in_progress":
        await forget();
        return unconfirmed("card_in_progress");
      // Nothing was captured
      case "no_paypal_order":
      case "not_approved":
      case "gone":
      case "mismatch":
      case "awaiting_details":
      case "capture_declined":
        return notCompleted(`settle_${settled.reason}`);
    }
  };

  const decide = async (): Promise<ExpressCompleteResult> => {
    const remote = await deps.getPayPalOrder(paypalOrderId);
    if (!remote) return notCompleted("gone");
    const unit = remote.purchase_units?.[0];
    // Only a PayPal order the express create call opened; one from the payment step has its own route
    if (unit?.reference_id !== PAYPAL_EXPRESS_REFERENCE) return notCompleted("not_express");
    const orderId = unit.custom_id;
    if (typeof orderId !== "string" || !STORE_ID_RE.test(orderId)) return notCompleted("no_order_id");

    const existing = await deps.findOrder(orderId);
    // A repeat of a call that already went through, or the order was paid another way meanwhile: nothing more to take
    if (existing?.paymentStatus === "paid") return paid(existing);
    if (existing?.paymentRef === paypalOrderId) named = existing.id;
    const closed = !!existing && !isOpenOrder(existing);

    if (remote.status === "COMPLETED") {
      // PayPal has the money but the store never recorded it (the server stopped in between): record it now.
      // Only for an open order this PayPal order was already saved on, so nothing is created or changed from here.
      // Otherwise the money was taken and this call can't say for what: nothing is claimed about it
      if (!existing || closed || existing.paymentRef !== paypalOrderId) {
        console.error(`[checkout/paypal-express] PayPal order ${paypalOrderId} is completed, but ${orderReference(orderId)} ${existing ? (closed ? "is closed" : "doesn't name it") : "doesn't exist"}`);
        return unconfirmed(closed ? "order_closed" : "completed_unknown");
      }
      return settle(existing);
    }
    if (closed) return notCompleted("order_closed");
    if (remote.status !== "APPROVED") return notCompleted("not_approved");

    // A card payment for this checkout is already paid or settling: its order is left exactly as it is, and
    // PayPal takes nothing. Checked before anything below can tell the buyer they weren't charged
    if (existing && (await deps.cardPaymentInProgress(existing.stripePaymentIntentId))) {
      await forget();
      return unconfirmed("card_in_progress");
    }

    const approvedCents = paypalAmountCents(unit.amount);
    if (approvedCents === null) return notCompleted("amount");

    // The cart this PayPal order was opened for, as the order itself records it; the browser's only when it records none
    const recorded = cartFromPayPalItems(unit.items);
    if (!recorded.ok) return notCompleted("cart_record");
    const items = recorded.items ?? input.items;
    if (items.length === 0) return notCompleted("empty_cart");
    const pricing = await deps.priceCart(items);
    if (!pricing.ok) return notCompleted("cart");

    // The address PayPal holds, under the same rules as the checkout form
    const details = detailsFromPayPal(remote, input.phone);
    const { problem } = checkExpressDetails(details, pricing.allowedCountries);
    if (problem && problem !== "phone") return { status: "address_unusable", reason: paypalAddressReason(problem) };
    // The courier needs a number; the buyer is asked for one and the call is repeated with it
    if (problem === "phone") return { status: "needs_phone" };

    // The buyer approved one amount. If the cart costs something else now, nothing is taken
    if (!sameTotal(pricing.priced.total, approvedCents)) return { status: "price_changed" };

    // The order exists, with PayPal's address, before any money moves. From here on it may name the PayPal order
    named = orderId;
    const saved = await deps.saveOrder({ orderId, paypalOrderId, details, items });
    if (!saved.ok) {
      console.warn(`[checkout/paypal-express] ${orderReference(orderId)}: couldn't save the order: ${saved.error}`);
      return notCompleted("save");
    }
    return settle(saved.order);
  };

  const answer = await decide();
  // "You haven't been charged" has to stay true after it is said. An order that names this PayPal order
  // (this call saved it, or an earlier one whose capture didn't finish) could still be captured by PayPal's
  // notification or by a reload, so it stops naming it: settling then answers "awaiting_details" and takes nothing
  if (SAYS_NOT_CHARGED.has(answer.status)) await forget();
  return answer;
}
