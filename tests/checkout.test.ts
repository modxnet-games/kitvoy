import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type Stripe from "stripe";

import { hashCheckoutToken, isCheckoutToken, isOpenOrder, newCheckoutToken, HANDOFF_LINK_TTL_MS, SESSION_TTL_MS } from "../src/lib/checkout/resume-token";
import {
  CHECKOUT_STORAGE_KEY,
  cleanDraft,
  clearCheckoutRecord,
  parseCheckoutRecord,
  paypalReturnFromUrl,
  readCheckoutRecord,
  resumeLinkFromUrl,
  saveCheckoutDraft,
  saveCheckoutOrder,
  withoutResumeLink,
} from "../src/lib/client/checkout-storage";
import { detectInAppBrowser, externalBrowserUrl } from "../src/lib/in-app-browser";
import { CHECKOUT_EVENTS, formatCheckoutEvent, sanitizeCheckoutEvent } from "../src/lib/checkout/events";
import { markOrderPaid, paidOrderWhere, type PaidOrderInput, type PaidOrderStore } from "../src/lib/payments/order-payment";
import { paypalEventTarget, settlePayPalOrder, type PayPalOrder, type SettleDeps, type SettleOrder } from "../src/lib/payments/paypal-settle";
import { paypalMode } from "../src/lib/checkout/payment-options";
import { orderLinesKey } from "../src/lib/orders";
import { ensureOrderPaymentIntent, intentMatchesOrder, intentMetadata, intentShipping, type IntentOrder } from "../src/lib/payments/stripe-intent";
import { buildOrderEvent, unitPricePaid } from "../src/lib/analytics/meta-capi";
import { toContents } from "../src/lib/analytics/meta-pixel";

const sha256 = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

/* ---------- resume tokens ---------- */

test("checkout tokens are random, URL-safe, and only their hash is storable", () => {
  const a = newCheckoutToken();
  const b = newCheckoutToken();
  assert.notEqual(a, b);
  assert.match(a, /^[A-Za-z0-9_-]{43}$/, "256 bits, base64url");
  assert.ok(isCheckoutToken(a));
  for (const bad of ["", "short", a + "x", a.slice(1), `${a.slice(0, 42)}!`, null, undefined, 42, { token: a }]) {
    assert.equal(isCheckoutToken(bad), false);
  }
  assert.match(hashCheckoutToken(a), /^[0-9a-f]{64}$/);
  assert.equal(hashCheckoutToken(a), hashCheckoutToken(a));
  assert.notEqual(hashCheckoutToken(a), hashCheckoutToken(b));
  assert.ok(!hashCheckoutToken(a).includes(a), "the stored value never contains the token");
  assert.ok(HANDOFF_LINK_TTL_MS <= 15 * 60 * 1000, "links in URLs are short-lived");
  assert.equal(SESSION_TTL_MS, 48 * 60 * 60 * 1000);
});

test("only a pending, unpaid order is reused by a retry", () => {
  assert.equal(isOpenOrder({ status: "PENDING", paymentStatus: "unpaid" }), true);
  assert.equal(isOpenOrder({ status: "PENDING", paymentStatus: "paid" }), false);
  assert.equal(isOpenOrder({ status: "CONFIRMED", paymentStatus: "paid" }), false);
  assert.equal(isOpenOrder({ status: "CANCELED", paymentStatus: "unpaid" }), false);
});

/* ---------- what the browser keeps ---------- */

const draft = { email: "test@example.com", fullName: "Test Customer", phone: "(202) 555-0143", address1: "123 Test St", city: "Washington", state: "DC", zip: "20001" };
const token = newCheckoutToken();
const NOW = 1_800_000_000_000;

test("the stored checkout holds a draft before the order exists and only token + reference after", () => {
  const before = parseCheckoutRecord(JSON.stringify({ v: 1, savedAt: NOW, draft }), NOW);
  assert.deepEqual(before, { v: 1, savedAt: NOW, draft });

  // Once an order exists nothing personal is kept, even if a draft was left in the stored value
  const after = parseCheckoutRecord(JSON.stringify({ v: 1, savedAt: NOW, token, orderReference: "KTV-ABCD1234", draft }), NOW);
  assert.deepEqual(after, { v: 1, savedAt: NOW, token, orderReference: "KTV-ABCD1234" });
  assert.equal(JSON.stringify(after).includes("example.com"), false);

  // 48 hours, then gone
  assert.equal(parseCheckoutRecord(JSON.stringify({ v: 1, savedAt: NOW - SESSION_TTL_MS - 1, draft }), NOW), null);
  assert.ok(parseCheckoutRecord(JSON.stringify({ v: 1, savedAt: NOW - SESSION_TTL_MS + 1000, draft }), NOW));
  assert.equal(parseCheckoutRecord(JSON.stringify({ v: 1, savedAt: NOW + 10 * 60_000, draft }), NOW), null, "a timestamp from the future is not trusted");

  for (const bad of [null, "", "not json", "{}", JSON.stringify({ v: 2, savedAt: NOW, draft }), JSON.stringify({ v: 1, savedAt: "now", draft }), JSON.stringify({ v: 1, savedAt: NOW })]) {
    assert.equal(parseCheckoutRecord(bad, NOW), null);
  }
  // A token without a valid reference (or the reverse) is not an order record
  assert.equal(parseCheckoutRecord(JSON.stringify({ v: 1, savedAt: NOW, token, orderReference: "nope" }), NOW), null);
  assert.equal(parseCheckoutRecord(JSON.stringify({ v: 1, savedAt: NOW, token: "nope", orderReference: "KTV-ABCD1234" }), NOW), null);
});

test("a draft keeps only the form's own fields", () => {
  const { zip: _zip, ...withoutZip } = draft;
  void _zip;
  // Unknown keys, blanks and non-strings are dropped
  assert.deepEqual(cleanDraft({ ...draft, address2: "  ", cardNumber: "4242", password: "x", zip: 20001 }), withoutZip);
  assert.deepEqual(cleanDraft(null), {});
  assert.equal(cleanDraft({ fullName: "x".repeat(500) }).fullName?.length, 200);
});

test("saving the order drops the draft, and later typing is not stored", () => {
  const store = new Map<string, string>();
  const g = globalThis as unknown as { localStorage?: object };
  const had = "localStorage" in g;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
  try {
    saveCheckoutDraft(draft);
    assert.deepEqual(readCheckoutRecord()?.draft, draft);

    saveCheckoutOrder(token, "KTV-ABCD1234");
    const stored = store.get(CHECKOUT_STORAGE_KEY) ?? "";
    assert.equal(stored.includes("Test Customer"), false, "the draft is gone the moment the order exists");
    assert.equal(stored.includes("example.com"), false);
    assert.deepEqual(Object.keys(JSON.parse(stored)).sort(), ["orderReference", "savedAt", "token", "v"]);

    saveCheckoutDraft({ ...draft, fullName: "Edited Name" });
    assert.equal((store.get(CHECKOUT_STORAGE_KEY) ?? "").includes("Edited Name"), false, "after the order exists the browser keeps no details");
    assert.equal(readCheckoutRecord()?.token, token);

    clearCheckoutRecord();
    assert.equal(store.has(CHECKOUT_STORAGE_KEY), false, "paid: nothing stays");
    saveCheckoutOrder("bad-token", "KTV-ABCD1234");
    assert.equal(store.has(CHECKOUT_STORAGE_KEY), false);
  } finally {
    if (!had) delete g.localStorage;
  }
});

test("a resume link's token is read from the query or the fragment and then removed from the URL", () => {
  assert.equal(resumeLinkFromUrl(`https://kitvoy.com/checkout?r=${token}`), token);
  assert.equal(resumeLinkFromUrl(`https://kitvoy.com/checkout#r=${token}`), token);
  assert.equal(resumeLinkFromUrl(`https://kitvoy.com/checkout?pp=return&r=${token}&token=5AB&PayerID=X`), token);
  assert.equal(resumeLinkFromUrl("https://kitvoy.com/checkout?r=tooshort"), null);
  assert.equal(resumeLinkFromUrl("https://kitvoy.com/checkout"), null);

  assert.equal(withoutResumeLink(`https://kitvoy.com/checkout?r=${token}`), "/checkout");
  assert.equal(withoutResumeLink(`https://kitvoy.com/checkout?step=2&r=${token}`), "/checkout?step=2");
  assert.equal(withoutResumeLink(`https://kitvoy.com/checkout#r=${token}`), "/checkout");
  assert.equal(withoutResumeLink("https://kitvoy.com/checkout?utm_source=facebook#bundles"), "/checkout?utm_source=facebook#bundles");
});

/* ---------- Meta's in-app browsers ---------- */

test("Facebook, Messenger, Instagram and Threads web views are detected; real browsers are not", () => {
  const cases: [string, ReturnType<typeof detectInAppBrowser>][] = [
    ["Mozilla/5.0 (Linux; Android 17; SM-A166U Build/CP2A.260605.016) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/156.0.8078.47 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/574.0.0.40.71;IABMV/1;]", "facebook"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 [FBAN/FBIOS;FBAV/480.0.0.38.107;FBBV/1;FBDV/iPhone15,3]", "facebook"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 [FBAN/MessengerLiteForiOS;FBAV/470.0.0.31.108]", "facebook"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/24B119 Instagram 454.1.0.41.71 (iPhone15,3; iOS 27_2; en_US; en; scale=3.00; 1290x2796; IABMV/1; 1106185088) Safari/604.1", "instagram"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 Barcelona 350.0.0.30.109 Android (34/14; 420dpi)", "threads"],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/22A3354 Barcelona 350.0.0 Instagram 350.0.0 (iPhone15,3)", "threads"],
    ["Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36", null],
    ["Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1", null],
    ["Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36", null],
    ["", null],
  ];
  for (const [ua, expected] of cases) assert.equal(detectInAppBrowser(ua), expected, ua.slice(-60));
  assert.equal(detectInAppBrowser(null), null);
});

test("PayPal is a pop-up in real browsers and a full-page redirect in in-app browsers", () => {
  assert.equal(paypalMode({ paypalConfigured: true, inAppBrowser: false }), "buttons");
  assert.equal(paypalMode({ paypalConfigured: true, inAppBrowser: true }), "redirect");
  assert.equal(paypalMode({ paypalConfigured: false, inAppBrowser: true }), null);
  assert.equal(paypalMode({ paypalConfigured: false, inAppBrowser: false }), null);
});

/* ---------- one order, one PaymentIntent ---------- */

test("order lines compare the same whatever order they were saved in", () => {
  const a = [{ productId: "p1", quantity: 2, unitPrice: 59.99 }, { productId: "p2", quantity: 1, unitPrice: 10 }];
  assert.equal(orderLinesKey(a), orderLinesKey([...a].reverse()));
  assert.notEqual(orderLinesKey(a), orderLinesKey([{ ...a[0], quantity: 3 }, a[1]]));
  assert.notEqual(orderLinesKey(a), orderLinesKey([{ ...a[0], unitPrice: 49.99 }, a[1]]));
});

const order: IntentOrder = {
  id: "cmw9wrjyz00044ku7za4og2cg",
  total: 59.99,
  customerName: "Test Customer",
  phone: "(202) 555-0143",
  location: "123 Test St, Washington, DC 20001",
  shippingAddress: { address1: "123 Test St", address2: "", city: "Washington", state: "DC", zip: "20001", country: "US" },
  stripePaymentIntentId: "pi_old",
  utmSource: "facebook",
  utmMedium: "paid",
  utmCampaign: "launch",
  utmContent: null,
  utmTerm: null,
  fbclid: null,
};

/** An intent as Stripe would return it for `order`. */
const intentFor = (o: IntentOrder, overrides: Partial<Stripe.PaymentIntent> = {}) =>
  ({
    id: "pi_old",
    status: "requires_payment_method",
    amount: Math.round(o.total * 100),
    client_secret: "pi_old_secret_x",
    shipping: { name: o.customerName, phone: o.phone, address: { line1: "123 Test St", line2: null, city: "Washington", state: "DC", postal_code: "20001", country: "US" } },
    ...overrides,
  }) as unknown as Stripe.PaymentIntent;

/** A stand-in for the Stripe client that records what the helper asked of it. */
function fakeStripe(existing: Stripe.PaymentIntent | Error, behaviour: { updateFails?: boolean } = {}) {
  const calls: { op: string; args: unknown[] }[] = [];
  const stripe = {
    paymentIntents: {
      retrieve: async (...args: unknown[]) => {
        calls.push({ op: "retrieve", args });
        if (existing instanceof Error) throw existing;
        return existing;
      },
      update: async (...args: unknown[]) => {
        calls.push({ op: "update", args });
        if (behaviour.updateFails) throw new Error("This PaymentIntent could not be updated");
        return { ...(existing as Stripe.PaymentIntent), ...(args[1] as object), client_secret: "pi_old_secret_x" };
      },
      cancel: async (...args: unknown[]) => {
        calls.push({ op: "cancel", args });
        return {};
      },
      create: async (...args: unknown[]) => {
        calls.push({ op: "create", args });
        return { id: "pi_new", client_secret: "pi_new_secret_y", status: "requires_payment_method" };
      },
    },
  } as unknown as Pick<Stripe, "paymentIntents">;
  return { stripe, calls, ops: () => calls.map((c) => c.op) };
}

test("an open intent that still matches the order is reused untouched", async () => {
  const { stripe, ops } = fakeStripe(intentFor(order));
  const saved: string[] = [];
  const result = await ensureOrderPaymentIntent(stripe, order, async (_o, id) => { saved.push(id); });
  assert.deepEqual(result, { ok: true, clientSecret: "pi_old_secret_x", intentId: "pi_old" });
  assert.deepEqual(ops(), ["retrieve"], "no update, no cancel, no second intent");
  assert.deepEqual(saved, []);
});

test("a changed total or address updates the same intent in place", async () => {
  const pair = { ...order, total: 99.99 };
  const { stripe, calls, ops } = fakeStripe(intentFor(order));
  const result = await ensureOrderPaymentIntent(stripe, pair, async () => {});
  assert.equal(result.ok && result.intentId, "pi_old");
  assert.deepEqual(ops(), ["retrieve", "update"]);
  assert.equal((calls[1].args[1] as { amount: number }).amount, 9999);

  const moved = { ...order, shippingAddress: { address1: "9 Other Rd", address2: "Apt 2", city: "Austin", state: "TX", zip: "73301" } };
  assert.equal(intentMatchesOrder(intentFor(order), moved), false);
  const second = fakeStripe(intentFor(order));
  await ensureOrderPaymentIntent(second.stripe, moved, async () => {});
  assert.deepEqual(second.ops(), ["retrieve", "update"]);
  assert.equal((second.calls[1].args[1] as { shipping: { address: { city: string } } }).shipping.address.city, "Austin");
});

test("a canceled or missing stored intent is never reused: a fresh one is created", async () => {
  for (const existing of [intentFor(order, { status: "canceled" }), Object.assign(new Error("No such payment_intent"), { code: "resource_missing" })]) {
    const { stripe, calls, ops } = fakeStripe(existing);
    const saved: [string, string][] = [];
    const result = await ensureOrderPaymentIntent(stripe, order, async (o, id) => { saved.push([o, id]); });
    assert.deepEqual(result, { ok: true, clientSecret: "pi_new_secret_y", intentId: "pi_new" });
    assert.deepEqual(ops(), ["retrieve", "create"], "the stored intent is left alone, not canceled or updated");
    assert.deepEqual(saved, [[order.id, "pi_new"]], "the order now points at the fresh intent");
    const [params, options] = calls[1].args as [{ amount: number; metadata: Record<string, string> }, { idempotencyKey: string }];
    assert.equal(params.amount, 5999);
    assert.equal(params.metadata.orderReference, "KTV-ZA4OG2CG");
    assert.match(options.idempotencyKey, /^pi-cmw9wrjyz00044ku7za4og2cg-5999-pi_old-[0-9a-f]{12}$/);
  }
});

test("an intent Stripe refuses to update is replaced, and one that is paid or settling is left for the webhook", async () => {
  const refused = fakeStripe(intentFor(order), { updateFails: true });
  const result = await ensureOrderPaymentIntent(refused.stripe, { ...order, total: 99.99 }, async () => {});
  assert.equal(result.ok && result.intentId, "pi_new");
  assert.deepEqual(refused.ops(), ["retrieve", "update", "cancel", "create"]);

  for (const status of ["succeeded", "processing", "requires_capture"] as const) {
    const settled = fakeStripe(intentFor(order, { status }));
    assert.deepEqual(await ensureOrderPaymentIntent(settled.stripe, order, async () => {}), { ok: false, intentStatus: status });
    assert.deepEqual(settled.ops(), ["retrieve"]);
  }

  // Stripe being down is an error, not a reason to create a duplicate
  const down = fakeStripe(new Error("connection reset"));
  await assert.rejects(() => ensureOrderPaymentIntent(down.stripe, order, async () => {}));
  assert.deepEqual(down.ops(), ["retrieve"]);
});

test("the intent carries the order ids and ad attribution, and no personal data in its metadata", () => {
  assert.deepEqual(intentMetadata(order), { orderId: order.id, orderReference: "KTV-ZA4OG2CG", utm_source: "facebook", utm_medium: "paid", utm_campaign: "launch" });
  assert.equal(JSON.stringify(intentMetadata(order)).includes("Test Customer"), false);
  assert.deepEqual(intentShipping(order).address, { line1: "123 Test St", line2: undefined, city: "Washington", state: "DC", postal_code: "20001", country: "US" });
});

/* ---------- Meta events ---------- */

test("bundle lines report what one unit really cost", () => {
  assert.equal(unitPricePaid(59.99, 1), 59.99);
  assert.equal(unitPricePaid(99.99, 2), 50, "two for $99.99 is $50.00 each, not $59.99");
  assert.equal(unitPricePaid(134.98, 3), 44.99);
  assert.equal(unitPricePaid(0, 0), 0);

  const product = { id: "p1", sku: "INF-001", name: "Inflator", price: 59.99 };
  assert.deepEqual(toContents([{ product, quantity: 1 }]), [{ id: "INF-001", quantity: 1, item_price: 59.99 }]);
  assert.deepEqual(toContents([{ product, quantity: 2 }]), [{ id: "INF-001", quantity: 2, item_price: 50 }]);
  assert.deepEqual(toContents([{ product, quantity: 3 }]), [{ id: "INF-001", quantity: 3, item_price: 44.99 }]);
});

test("the server Purchase and InitiateCheckout use the order reference as event_id and carry the order's own fbp/fbc and hashed contact", () => {
  const paid = {
    id: "cmw9wrjyz00044ku7za4og2cg",
    email: "Test@Example.com ",
    phone: "(202) 555-0143",
    customerName: "Test Customer",
    shippingAddress: { city: "Washington", state: "DC", zip: "20001", country: "US" },
    // Saved when the checkout started, in the customer's own browser
    attribution: { fbp: "fb.1.1794267000000.1234567890", fbc: "fb.1.1794267000000.IwAR0abc", clientIp: "203.0.113.7", userAgent: "Mozilla/5.0 test", eventSourceUrl: "/checkout" },
    userId: null,
    total: 99.99,
  };
  const contents = [{ id: "INF-001", quantity: 2, item_price: 50 }];

  const purchase = buildOrderEvent("Purchase", paid, contents, 1_794_267_900);
  assert.equal(purchase.event_name, "Purchase");
  assert.equal(purchase.event_id, "KTV-ZA4OG2CG", "the same id the browser pixel sends");
  assert.equal(purchase.action_source, "website");
  assert.match(purchase.event_source_url, /^https?:\/\/[^/]+\/checkout$/);
  assert.equal(purchase.user_data.fbp, "fb.1.1794267000000.1234567890");
  assert.equal(purchase.user_data.fbc, "fb.1.1794267000000.IwAR0abc");
  assert.deepEqual(purchase.user_data.em, [sha256("test@example.com")]);
  assert.deepEqual(purchase.user_data.ph, [sha256("12025550143")]);
  assert.equal(purchase.user_data.client_ip_address, "203.0.113.7");
  assert.equal(JSON.stringify(purchase).includes("example.com"), false, "no raw email leaves the server");
  assert.equal(JSON.stringify(purchase).includes("555-0143"), false, "no raw phone leaves the server");
  assert.deepEqual(purchase.custom_data, { currency: "USD", value: 99.99, content_type: "product", content_ids: ["INF-001"], contents, num_items: 2, order_id: "KTV-ZA4OG2CG" });

  const started = buildOrderEvent("InitiateCheckout", paid, contents, 1_794_267_800);
  assert.equal(started.event_id, "KTV-ZA4OG2CG", "a retried checkout repeats the id, so Meta counts it once");
  assert.equal("order_id" in started.custom_data, false);
  assert.equal(started.user_data.fbp, purchase.user_data.fbp);

  // An order with no browser ids (pixel blocked) still sends, with what it has
  const bare = buildOrderEvent("Purchase", { ...paid, attribution: null }, contents, 1);
  assert.equal(bare.user_data.fbp, undefined);
  assert.deepEqual(bare.user_data.em, [sha256("test@example.com")]);
});

/* ---------- PayPal: one idempotent path to "paid" ---------- */

const unpaid: SettleOrder = { id: "cmw9wrjyz00044ku7za4og2cg", total: 59.99, paymentStatus: "unpaid", paymentRef: "5AB12345CD678901E", stripePaymentIntentId: "pi_1" };

const paypalOrder = (
  status: string,
  overrides: { customId?: string; value?: string; captured?: boolean; captureId?: string; captureStatus?: string } = {},
): PayPalOrder => ({
  id: "5AB12345CD678901E",
  status,
  purchase_units: [
    {
      custom_id: overrides.customId ?? unpaid.id,
      amount: { value: overrides.value ?? "59.99", currency_code: "USD" },
      payments: overrides.captured
        ? {
            captures: [
              {
                id: overrides.captureId ?? "CAP123",
                status: overrides.captureStatus ?? "COMPLETED",
                amount: { value: overrides.value ?? "59.99", currency_code: "USD" },
                seller_receivable_breakdown: { paypal_fee: { value: "2.58", currency_code: "USD" } },
              },
            ],
          }
        : undefined,
    },
  ],
});

/**
 * The outside world of settling, recorded. `paidBy` and `total` are the store
 * order's state, shared between concurrent callers. `editedTo` is a total the
 * buyer's own edit gives the order while PayPal is capturing; `captureStatus`
 * is how PayPal leaves the capture.
 */
function settleWorld(remote: PayPalOrder | null, options: { cardInProgress?: boolean; alreadyPaidBy?: string; editedTo?: number; captureStatus?: string } = {}) {
  const state: { remote: PayPalOrder | null; paidBy: string | null; total: number } = { remote, paidBy: options.alreadyPaidBy ?? null, total: unpaid.total };
  const log: string[] = [];
  const deps: SettleDeps = {
    getOrder: async () => {
      log.push("get");
      return state.remote;
    },
    capture: async () => {
      log.push("capture");
      state.remote = paypalOrder("COMPLETED", { captured: true, captureStatus: options.captureStatus });
      if (options.editedTo !== undefined) state.total = options.editedTo;
      return state.remote;
    },
    cardPaymentInProgress: async () => options.cardInProgress ?? false,
    // As completePaidOrder decides: only an unpaid order that still costs what was taken
    complete: async (_orderId, captureRef, fee, paidTotal) => {
      if (state.paidBy || Math.round(state.total * 100) !== Math.round(paidTotal * 100)) return false;
      state.paidBy = captureRef;
      log.push(`complete:${captureRef}:${fee}`);
      return true;
    },
    paidRef: async () => state.paidBy,
    afterPaid: () => {
      log.push("afterPaid");
    },
    refundDuplicate: async (captureId, _orderId, paidBy) => {
      log.push(`refund:${captureId}:${paidBy}`);
    },
    refundUnmatched: async ({ captureId, paid }) => {
      log.push(`unmatched:${captureId}:${paid}`);
    },
    forget: async () => {
      log.push("forget");
    },
  };
  return { deps, log, state };
}

test("an approved PayPal order is captured once, marks the order paid and runs the paid steps once", async () => {
  const { deps, log } = settleWorld(paypalOrder("APPROVED"));
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, deps), { status: "paid" });
  assert.deepEqual(log, ["get", "capture", "complete:CAP123:2.58", "afterPaid"]);
});

test("the browser and the webhook settling the same order together still capture and notify once", async () => {
  const world = settleWorld(paypalOrder("APPROVED"));
  const [a, b] = await Promise.all([settlePayPalOrder(unpaid, unpaid.paymentRef, world.deps), settlePayPalOrder(unpaid, unpaid.paymentRef, world.deps)]);
  assert.deepEqual([a, b], [{ status: "paid" }, { status: "paid" }]);
  assert.equal(world.log.filter((l) => l === "afterPaid").length, 1, "one confirmation, one Meta Purchase, one fulfillment request");
  assert.equal(world.log.filter((l) => l.startsWith("complete:")).length, 1);
  assert.equal(world.log.filter((l) => l.startsWith("refund:")).length, 0, "the same capture is never refunded as a duplicate");

  // A later run (PayPal's retry, a reload) finds it paid and does nothing
  const later = settleWorld(paypalOrder("COMPLETED", { captured: true }), { alreadyPaidBy: "CAP123" });
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, later.deps), { status: "paid" });
  assert.deepEqual(later.log, ["get"]);
  // And an order the database already shows as paid doesn't even ask PayPal
  const done = settleWorld(paypalOrder("COMPLETED", { captured: true }));
  assert.deepEqual(await settlePayPalOrder({ ...unpaid, paymentStatus: "paid" }, unpaid.paymentRef, done.deps), { status: "paid" });
  assert.deepEqual(done.log, []);
});

test("a PayPal payment the store captured but never recorded is completed without capturing again", async () => {
  const { deps, log } = settleWorld(paypalOrder("COMPLETED", { captured: true }));
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, deps), { status: "paid" });
  assert.deepEqual(log, ["get", "complete:CAP123:2.58", "afterPaid"]);
});

test("nothing is captured unless PayPal says the buyer approved this order for this total", async () => {
  const cases: [PayPalOrder | null, string][] = [
    [paypalOrder("CREATED"), "not_approved"],
    [paypalOrder("PAYER_ACTION_REQUIRED"), "not_approved"],
    [null, "gone"],
    [paypalOrder("APPROVED", { value: "99.99" }), "mismatch"],
    [paypalOrder("APPROVED", { customId: "cmw9wlz3700024ku7uyi1a53z" }), "mismatch"],
    [paypalOrder("VOIDED"), "not_completed"],
  ];
  for (const [remote, reason] of cases) {
    const { deps, log } = settleWorld(remote);
    assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, deps), { status: "open", reason });
    assert.equal(log.includes("capture"), false, reason);
    assert.equal(log.includes("afterPaid"), false, reason);
    assert.equal(log.includes("forget"), reason === "mismatch", "a PayPal order for another amount is dropped from the order");
  }
  const none = settleWorld(paypalOrder("APPROVED"));
  assert.deepEqual(await settlePayPalOrder({ ...unpaid, paymentRef: null }, null, none.deps), { status: "open", reason: "no_paypal_order" });
  assert.deepEqual(none.log, []);

  // A card payment already settling for the same order: PayPal isn't captured on top of it
  const card = settleWorld(paypalOrder("APPROVED"), { cardInProgress: true });
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, card.deps), { status: "open", reason: "card_in_progress" });
  assert.equal(card.log.includes("capture"), false);
});

test("a PayPal capture for an order a card already paid is refunded, not kept", async () => {
  const { deps, log } = settleWorld(paypalOrder("COMPLETED", { captured: true }), { alreadyPaidBy: "pi_card" });
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, deps), { status: "paid" });
  assert.deepEqual(log, ["get", "refund:CAP123:pi_card"]);
});

test("an order edited while PayPal was capturing is not paid by that capture: the money goes back and the owner is told", async () => {
  // The buyer approved $59.99; while the capture ran, the same checkout was saved again with a bigger cart
  const world = settleWorld(paypalOrder("APPROVED"), { editedTo: 134.98 });
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, world.deps), { status: "open", reason: "order_changed" });
  assert.deepEqual(world.log, ["get", "capture", "unmatched:CAP123:59.99", "forget"]);
  assert.equal(world.state.paidBy, null, "never marked paid: not for the cart that was paid for, and not for the new one");
  assert.equal(world.log.includes("afterPaid"), false, "no confirmation, no Purchase event, nothing sent to the supplier");

  // Whoever looks at it afterwards (PayPal's notification, a reload) finds a completed capture for an amount the
  // order doesn't cost. Should the first caller have stopped before dealing with it, the money still goes back
  const later = settleWorld(paypalOrder("COMPLETED", { captured: true }));
  assert.deepEqual(await settlePayPalOrder({ ...unpaid, total: 134.98, paymentRef: null }, unpaid.paymentRef, later.deps), { status: "open", reason: "order_changed" });
  assert.deepEqual(later.log, ["get", "unmatched:CAP123:59.99", "forget"]);

  // Once PayPal shows the capture as refunded there is nothing left to give back, or to say
  const refunded = settleWorld(paypalOrder("COMPLETED", { captured: true, captureStatus: "REFUNDED" }));
  assert.deepEqual(await settlePayPalOrder({ ...unpaid, total: 134.98, paymentRef: null }, unpaid.paymentRef, refunded.deps), { status: "open", reason: "mismatch" });
  assert.deepEqual(refunded.log, ["get", "forget"]);

  // A completed PayPal order that belongs to another store order is never refunded from here
  const foreign = settleWorld(paypalOrder("COMPLETED", { captured: true, customId: "cmw9wlz3700024ku7uyi1a53z" }));
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, foreign.deps), { status: "open", reason: "mismatch" });
  assert.deepEqual(foreign.log, ["get", "forget"]);
});

test("PayPal's capture carries the amount it took to the one write that marks the order paid", async () => {
  const seen: number[] = [];
  const world = settleWorld(paypalOrder("APPROVED"));
  const complete = world.deps.complete;
  world.deps.complete = (orderId, captureRef, fee, paidTotal) => {
    seen.push(paidTotal);
    return complete(orderId, captureRef, fee, paidTotal);
  };
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, world.deps), { status: "paid" });
  assert.deepEqual(seen, [59.99]);
});

test("a capture PayPal is holding or has refused is told apart from one whose outcome isn't known", async () => {
  // Held (a review, an eCheck): the order keeps naming the PayPal order, so the notification that follows completes it
  const held = settleWorld(paypalOrder("APPROVED"), { captureStatus: "PENDING" });
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, held.deps), { status: "open", reason: "capture_pending" });
  assert.deepEqual(held.log, ["get", "capture"], "not marked paid, and nothing dropped from the order");
  // The notification, once the money is in
  held.state.remote = paypalOrder("COMPLETED", { captured: true });
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, held.deps), { status: "paid" });
  assert.equal(held.log.filter((l) => l === "afterPaid").length, 1);

  for (const captureStatus of ["DECLINED", "FAILED"]) {
    const refused = settleWorld(paypalOrder("APPROVED"), { captureStatus });
    assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, refused.deps), { status: "open", reason: "capture_declined" }, captureStatus);
    assert.equal(refused.state.paidBy, null);
  }

  // Anything else PayPal reports about a capture says nothing certain
  const odd = settleWorld(paypalOrder("APPROVED"), { captureStatus: "PARTIALLY_REFUNDED" });
  assert.deepEqual(await settlePayPalOrder(unpaid, unpaid.paymentRef, odd.deps), { status: "open", reason: "not_completed" });
});

/* ---------- marking an order paid ---------- */

/** One order row and its stock, as the paid-order write sees them. */
function paidOrderStore(row: { id: string; paymentStatus: string; total: number }) {
  const log: string[] = [];
  const store: PaidOrderStore = {
    markPaid: async (where, data) => {
      const matches = row.id === where.id && row.paymentStatus !== where.paymentStatus.not && row.total >= where.total.gte && row.total < where.total.lt;
      if (!matches) return 0;
      row.paymentStatus = data.paymentStatus;
      log.push(`paid:${data.paymentRef}:${data.paymentMethod ?? ""}:${data.paymentFee ?? ""}:${data.testPayment}`);
      return 1;
    },
    items: async () => [
      { productId: "p1", quantity: 2 },
      { productId: null, quantity: 1 },
    ],
    takeFromStock: async (productId, quantity) => {
      log.push(`stock:${productId}:-${quantity}`);
    },
  };
  return { store, log, row };
}

const payment = (changes: Partial<PaidOrderInput> = {}): PaidOrderInput => ({ orderId: unpaid.id, paymentRef: "CAP123", paidTotal: 59.99, paymentFee: 2.58, paymentMethod: "paypal", ...changes });

test("an order is marked paid once, by a payment for exactly what it costs, and only then leaves stock", async () => {
  const world = paidOrderStore({ id: unpaid.id, paymentStatus: "unpaid", total: 59.99 });
  assert.equal(await markOrderPaid(world.store, payment()), true);
  assert.deepEqual(world.log, ["paid:CAP123:paypal:2.58:false", "stock:p1:-2"]);

  // A second capture, a retried webhook, a card payment arriving late: the order is already paid
  assert.equal(await markOrderPaid(world.store, payment()), false);
  assert.equal(await markOrderPaid(world.store, payment({ paymentRef: "pi_late", paymentMethod: "card" })), false);
  assert.equal(world.log.length, 2, "nothing written and no stock taken twice");
});

test("an order that was edited while its payment was being taken is not marked paid for the amount that was settled", async () => {
  // Paid $59.99 for one; the order now holds three for $134.98
  const grown = paidOrderStore({ id: unpaid.id, paymentStatus: "unpaid", total: 134.98 });
  assert.equal(await markOrderPaid(grown.store, payment({ paidTotal: 59.99 })), false);
  assert.equal(grown.row.paymentStatus, "unpaid");
  assert.deepEqual(grown.log, [], "nothing written, nothing taken from stock");

  // The other way round, and a cent apart: still not this order's price
  for (const [total, paidTotal] of [[59.99, 134.98], [59.99, 59.98], [59.99, 60], [0.3, 0.31]] as const) {
    const world = paidOrderStore({ id: unpaid.id, paymentStatus: "unpaid", total });
    assert.equal(await markOrderPaid(world.store, payment({ paidTotal })), false, `${total} vs ${paidTotal}`);
  }
  // The same amount is the same amount however the float came out
  const float = paidOrderStore({ id: unpaid.id, paymentStatus: "unpaid", total: 0.1 + 0.2 });
  assert.equal(await markOrderPaid(float.store, payment({ paidTotal: 0.3 })), true);
  // A card payment says what it received in cents
  const card = paidOrderStore({ id: unpaid.id, paymentStatus: "unpaid", total: 134.98 });
  assert.equal(await markOrderPaid(card.store, payment({ paidTotal: 13498 / 100, paymentRef: "pi_1", paymentMethod: "card", paymentFee: undefined, testPayment: true })), true);
  assert.deepEqual(card.log, ["paid:pi_1:card::true", "stock:p1:-2"]);

  // Another order's id, or an amount that isn't a payment, marks nothing
  const other = paidOrderStore({ id: "cmw9wlz3700024ku7uyi1a53z", paymentStatus: "unpaid", total: 59.99 });
  assert.equal(await markOrderPaid(other.store, payment()), false);
  for (const paidTotal of [0, -59.99, Number.NaN, Number.POSITIVE_INFINITY]) {
    const world = paidOrderStore({ id: unpaid.id, paymentStatus: "unpaid", total: 59.99 });
    assert.equal(await markOrderPaid(world.store, payment({ paidTotal })), false, String(paidTotal));
    assert.equal(paidOrderWhere(unpaid.id, paidTotal), null);
  }
});

test("the paid-order condition is one statement: the order, still unpaid, at the settled total to the cent", async () => {
  const where = paidOrderWhere(unpaid.id, 59.99);
  assert.ok(where);
  assert.equal(where.id, unpaid.id);
  assert.deepEqual(where.paymentStatus, { not: "paid" });
  assert.ok(where.total.gte <= 59.99 && 59.99 < where.total.lt);
  assert.ok(where.total.lt - where.total.gte <= 0.01 + 1e-9, "no wider than one cent");
  assert.ok(!(59.98 >= where.total.gte) && !(60 < where.total.lt));

  const { readFile } = await import("node:fs/promises");
  const lib = (await readFile("src/lib/payments/order-payment.ts", "utf8")).replace(/\r\n/g, "\n");
  // The condition and the write are the same updateMany, inside the transaction that takes the stock
  assert.match(lib, /prisma\.\$transaction\(\(tx\) =>\s+markOrderPaid\(/);
  assert.match(lib, /markPaid: async \(where, data\) => \(await tx\.order\.updateMany\(\{ where, data \}\)\)\.count/);

  // Both providers hand over what they actually took
  const webhook = await readFile("src/app/api/webhooks/stripe/route.ts", "utf8");
  assert.match(webhook, /paidTotal: intent\.amount_received \/ 100/);
  // A card payment that no longer matches is flagged to the owner, not marked paid and not passed off as a duplicate
  const afterFlip = webhook.slice(webhook.indexOf("const paid = await completePaidOrder("), webhook.indexOf("async function refundDuplicate"));
  assert.match(afterFlip, /if \(current\?\.paymentStatus !== "paid"\) \{\s+[^]*?sendOwnerAlert\(`Card payment amount doesn't match[^]*?return;\s+\}\s+\/\/ Already paid/);
  const settle = await readFile("src/lib/payments/paypal-settle.ts", "utf8");
  assert.match(settle, /deps\.complete\(order\.id, captureRef, Number\.isFinite\(fee\) \? fee : undefined, Number\(capture\.amount\?\.value\)\)/);
  assert.match(settle, /completePaidOrder\(\{ orderId, paymentRef: captureRef, paidTotal, paymentFee: fee, paymentMethod: "paypal" \}\)/);
  // "Not paid" is told apart from "paid by something else" by the order's payment status, not by its reference
  assert.match(settle, /paid\?\.paymentStatus === "paid" \? paid\.paymentRef \?\? "unknown" : null/);
});

test("a PayPal notification only names what to look up", () => {
  assert.deepEqual(
    paypalEventTarget({ event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "5AB12345CD678901E", status: "APPROVED", purchase_units: [{ custom_id: unpaid.id }] } }),
    { type: "CHECKOUT.ORDER.APPROVED", paypalOrderId: "5AB12345CD678901E", orderId: unpaid.id },
  );
  assert.deepEqual(
    paypalEventTarget({ event_type: "PAYMENT.CAPTURE.COMPLETED", resource: { id: "CAP123", custom_id: unpaid.id, supplementary_data: { related_ids: { order_id: "5AB12345CD678901E" } } } }),
    { type: "PAYMENT.CAPTURE.COMPLETED", paypalOrderId: "5AB12345CD678901E", orderId: unpaid.id },
  );
  for (const junk of [null, {}, { event_type: "BILLING.PLAN.CREATED", resource: { id: "P-1" } }, { event_type: "CHECKOUT.ORDER.APPROVED" }, { event_type: "CHECKOUT.ORDER.APPROVED", resource: { id: "'; drop table orders;--" } }]) {
    assert.equal(paypalEventTarget(junk), null);
  }
});

test("links out of an in-app browser ask the phone for its real browser", () => {
  const url = `https://kitvoy.com/checkout?r=${token}`;
  const android = externalBrowserUrl(url, "Mozilla/5.0 (Linux; Android 17; SM-A166U) Chrome/156 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/574.0;]");
  assert.equal(android, `intent://kitvoy.com/checkout?r=${token}#Intent;scheme=https;S.browser_fallback_url=${encodeURIComponent(url)};end`);
  assert.equal(externalBrowserUrl(url, "Mozilla/5.0 (iPhone; CPU iPhone OS 27_2 like Mac OS X) Mobile/24B119 Instagram 454.1"), `x-safari-${url}`);
  assert.equal(externalBrowserUrl(url, "Mozilla/5.0 (Windows NT 10.0) Chrome/130"), url);
  // Anything but https is passed through untouched, never wrapped in an app link
  assert.equal(externalBrowserUrl("http://kitvoy.com/checkout", "Android"), "http://kitvoy.com/checkout");
  assert.equal(externalBrowserUrl("not a url", "Android"), "not a url");
});

test("coming back from PayPal is recognised and its parameters are removed from the address bar", () => {
  assert.equal(paypalReturnFromUrl(`https://kitvoy.com/checkout?r=${token}&pp=return&token=5AB12345CD678901E&PayerID=ABCDEFGH`), "return");
  assert.equal(paypalReturnFromUrl(`https://kitvoy.com/checkout?r=${token}&pp=cancel&token=5AB12345CD678901E`), "cancel");
  assert.equal(paypalReturnFromUrl("https://kitvoy.com/checkout?pp=other"), null);
  assert.equal(paypalReturnFromUrl("https://kitvoy.com/checkout"), null);
  assert.equal(withoutResumeLink(`https://kitvoy.com/checkout?r=${token}&pp=return&token=5AB12345CD678901E&PayerID=ABCDEFGH`), "/checkout");
  // A `token` parameter that isn't PayPal's stays
  assert.equal(withoutResumeLink("https://kitvoy.com/account?token=abc"), "/account?token=abc");
});

/* ---------- the checkout log ---------- */

test("the checkout log takes only listed events and fields of a known shape, so no personal data can reach it", () => {
  for (const name of ["checkout_opened", "details_saved", "stripe_ready", "stripe_load_error", "pay_clicked", "pay_validation_error", "checkout_restored", "paypal_redirected"]) {
    assert.ok((CHECKOUT_EVENTS as readonly string[]).includes(name), name);
  }
  assert.deepEqual(
    sanitizeCheckoutEvent({ e: "pay_validation_error", ref: "KTV-ZA4OG2CG", app: "facebook", step: 2, ms: 1234.4, code: "incomplete_number", w: 384, sid: "k3j9x0aa" }),
    { e: "pay_validation_error", ref: "KTV-ZA4OG2CG", app: "facebook", step: 2, ms: 1234, code: "incomplete_number", w: 384, sid: "k3j9x0aa" },
  );
  // Unknown events, and anything that isn't an object, are dropped whole
  for (const bad of [null, "pay_clicked", [], {}, { e: "purchase" }, { e: 42 }, { e: "pay_clicked; drop" }]) assert.equal(sanitizeCheckoutEvent(bad), null);

  // Free text, wrong shapes and unknown keys never get through, whatever a caller sends
  const hostile = sanitizeCheckoutEvent({
    e: "pay_error",
    ref: "KTV-ZA4OG2CG<script>",
    app: "Dan's phone",
    step: 3,
    ms: -5,
    code: "card declined for dan@example.com",
    w: "wide",
    sid: "has spaces",
    email: "dan@example.com",
    name: "Dan",
    address: "512 Galaxy Ct",
    userAgent: "Mozilla/5.0",
  });
  assert.deepEqual(hostile, { e: "pay_error" });

  const line = formatCheckoutEvent({ e: "stripe_ready", ref: "KTV-ZA4OG2CG", ms: 1800, w: 390 }, new Date("2026-11-11T17:00:00.000Z"));
  assert.equal(line, '[checkout] {"t":"2026-11-11T17:00:00.000Z","e":"stripe_ready","ref":"KTV-ZA4OG2CG","ms":1800,"w":390}');
});
