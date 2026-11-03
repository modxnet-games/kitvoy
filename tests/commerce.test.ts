import test from "node:test";
import assert from "node:assert/strict";
import { getLineTotal, getBundleSavings } from "../src/lib/bundles";
import { validateCheckoutDetails, toShippingAddress, type CheckoutDetails } from "../src/lib/us-address";
import { useCartStore, getShippingForItems } from "../src/store/cart-store";
import type { ProductDisplay } from "../src/types/product";
import { buildCjOrderPayload, type CjOrderInput } from "../src/lib/fulfillment/cj-order";
import { cjFulfillment, isCjSandbox } from "../src/config/fulfillment";
import { buildCustomerMessageEmail } from "../src/lib/email";
import { validateAdminEmail } from "../src/lib/data/sent-emails";
import { buildSaleMessage } from "../src/lib/push/fcm";
import { salePush } from "../src/lib/push/admin-devices";
import { computeSalesOverview, type SalesOrder } from "../src/lib/data/sales-overview";

const product: ProductDisplay = { id: "unit-test", slug: "inflator", name: "Inflator", shortDescription: "", description: "", details: "", price: 59.99, shippingTax: 0, rating: 0, reviewCount: 0, stock: 9, sku: "TEST", isFeatured: false, category: { id: "test", slug: "test", name: "Test" }, images: [] };
const valid: CheckoutDetails = { email: "test@example.com", fullName: "Test Customer", phone: "2025550143", address1: "123 Test St", address2: "", city: "Washington", state: "DC", zip: "20001", paymentMethod: "paypal" };

test("shared pricing matches bundle totals and actual savings", () => {
  assert.deepEqual([1, 2, 3].map(q => getLineTotal(59.99, q)), [59.99, 99.99, 134.98]);
  assert.deepEqual([1, 2, 3].map(q => getBundleSavings(59.99, q)), [0, 19.99, 44.99]);
  assert.equal(getLineTotal(59.99, 4), 179.97);
  assert.equal(getLineTotal(63.27, 2), 106.55, "the pair is a fixed $19.99 off");
  // A much cheaper unit price can't make the pair a deeper discount than three (25%)
  assert.equal(getLineTotal(20, 2), 30);
  assert.ok(getLineTotal(59.99, 2) / 2 > getLineTotal(59.99, 3) / 3, "three stay the best value per inflator");
});

test("bundle replacement is exact, preserves other products, and rejects unavailable offers", () => {
  const cart = useCartStore.getState();
  cart.clearCart();
  cart.addItem({ ...product, id: "other" }, 1);
  cart.setOffer(product, 2);
  cart.setOffer(product, 3);
  assert.deepEqual(useCartStore.getState().items.map(item => [item.product.id, item.quantity]), [["other", 1], ["unit-test", 3]]);
  cart.setOffer(product, 10);
  cart.setOffer(product, 1.5);
  assert.equal(useCartStore.getState().items[1].quantity, 3);
  cart.clearCart();
});

test("catalog refresh updates price and stock without silently changing quantities", () => {
  const cart = useCartStore.getState();
  cart.setOffer(product, 3);
  cart.refreshCatalog([{ id: product.id, stock: 1, price: 65, shippingTax: 2 }]);
  assert.equal(useCartStore.getState().items[0].quantity, 3);
  assert.equal(useCartStore.getState().getSubtotal(), 146.25);
  assert.equal(getShippingForItems(useCartStore.getState().items), 6);
  cart.incrementItem(product.id);
  assert.equal(useCartStore.getState().items[0].quantity, 3);
  cart.decrementItem(product.id);
  assert.equal(useCartStore.getState().items[0].quantity, 2);
  cart.decrementItem(product.id);
  assert.equal(useCartStore.getState().items[0].quantity, 1);
  cart.incrementItem(product.id);
  assert.equal(useCartStore.getState().items[0].quantity, 1);
  cart.removeItem(product.id);
  assert.equal(useCartStore.getState().getItemCount(), 0);
});

test("missing catalog items remain visible for explicit removal", () => {
  const cart = useCartStore.getState();
  cart.setOffer(product, 2);
  cart.refreshCatalog([]);
  assert.equal(useCartStore.getState().items[0].product.stock, 0);
  assert.equal(useCartStore.getState().items[0].quantity, 2);
  cart.clearCart();
});

test("US delivery validation retains fulfillment fields and supports ZIP+4", () => {
  assert.deepEqual(validateCheckoutDetails(valid), {});
  assert.deepEqual(validateCheckoutDetails({ ...valid, zip: "20001-1234", phone: "+1 (202) 555-0143" }), {});
  const errors = validateCheckoutDetails({ ...valid, email: "invalid", phone: "123", state: "ZZ", zip: "12", fullName: "", address1: "", city: "" });
  assert.deepEqual(Object.keys(errors).sort(), ["address1", "city", "email", "fullName", "phone", "state", "zip"]);
  assert.equal(toShippingAddress(valid).country, "US");
});

function luminance(hex: string) {
  const channels = hex.match(/[0-9a-f]{2}/gi)!.map(v => parseInt(v, 16) / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
test("primary buttons and body text meet WCAG AA contrast for normal text", () => {
  for (const [a, b] of [["#c94b16", "#ffffff"], ["#666a67", "#faf9f6"], ["#171918", "#faf9f6"], ["#a83d10", "#faf9f6"]]) {
    const values = [luminance(a), luminance(b)].sort((x, y) => y - x);
    const ratio = (values[0] + .05) / (values[1] + .05);
    assert.ok(ratio >= 4.5, a + " / " + b + " contrast: " + ratio.toFixed(2));
  }
});

test("CJ order payload maps the product to its variant, aggregates quantities, and refuses incomplete orders", () => {
  const order: CjOrderInput = {
    id: "cmorder1234567890abcdefgh", reference: "KTV-ABCDEFGH", customerName: "Test Customer", email: "test@example.com", phone: "2025550143", total: 101.98,
    shippingAddress: toShippingAddress(valid),
    items: [{ productSlug: "cordless-tire-inflator", productName: "Cordless Tire Inflator", quantity: 2 }, { productSlug: "cordless-tire-inflator", productName: "Cordless Tire Inflator", quantity: 1 }],
  };
  const built = buildCjOrderPayload(order, { payType: 2, sandbox: false });
  assert.ok(built.ok);
  assert.deepEqual(built.payload.products, [{ vid: cjFulfillment.variants["cordless-tire-inflator"].vid, quantity: 3 }]);
  assert.equal(built.payload.orderNumber, order.id);
  assert.equal(built.payload.shippingProvince, "District of Columbia");
  assert.equal(built.payload.isSandbox, 0);
  assert.equal(built.payload.logisticName, "CJPacket Sensitive");
  assert.equal("shippingAddress2" in built.payload, false);
  const sandboxBuilt = buildCjOrderPayload(order, { payType: 3, sandbox: true });
  assert.ok(sandboxBuilt.ok);
  assert.equal(sandboxBuilt.payload.isSandbox, 1);
  assert.equal(buildCjOrderPayload({ ...order, items: [{ productSlug: "other", productName: "Other", quantity: 1 }] }, { payType: 2, sandbox: false }).ok, false);
  assert.equal(buildCjOrderPayload({ ...order, shippingAddress: null }, { payType: 2, sandbox: false }).ok, false);
});

test("CJ sandbox follows PayPal mode unless overridden", () => {
  const saved = { paypal: process.env.PAYPAL_ENV, cj: process.env.CJ_SANDBOX };
  process.env.PAYPAL_ENV = "sandbox"; delete process.env.CJ_SANDBOX;
  assert.equal(isCjSandbox(), true);
  process.env.PAYPAL_ENV = "live";
  assert.equal(isCjSandbox(), false);
  process.env.CJ_SANDBOX = "true";
  assert.equal(isCjSandbox(), true);
  process.env.PAYPAL_ENV = saved.paypal; process.env.CJ_SANDBOX = saved.cj;
  if (saved.paypal === undefined) delete process.env.PAYPAL_ENV;
  if (saved.cj === undefined) delete process.env.CJ_SANDBOX;
});

test("admin customer email escapes HTML, keeps paragraphs, and signs with the sender", () => {
  const { html, text } = buildCustomerMessageEmail({
    from: { name: "Kitvoy <Support>", email: "support@kitvoy.com" },
    subject: "Your order <b>KTV-1</b>",
    body: "Hi \"Sam\" & co,\r\n\r\n<script>alert('x')</script>\nSecond line",
  });
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;<br>Second line"));
  assert.ok(html.includes("Hi &quot;Sam&quot; &amp; co,</p>"));
  assert.ok(html.includes("<title>Your order &lt;b&gt;KTV-1&lt;/b&gt;</title>"));
  assert.ok(html.includes("Kitvoy &lt;Support&gt;"));
  assert.equal(text, "Hi \"Sam\" & co,\n\n<script>alert('x')</script>\nSecond line\n\n— Kitvoy <Support>\nsupport@kitvoy.com");
});

test("admin email validation rejects bad input and flattens the subject to one line", () => {
  const ok = validateAdminEmail({ sender: "support", to: " sam@example.com ", subject: "Hi\r\nBcc: evil@example.com", body: " Hello \r\n" });
  assert.ok(ok.ok);
  assert.deepEqual(ok.value, { sender: "support", to: "sam@example.com", subject: "Hi Bcc: evil@example.com", body: "Hello", orderId: null });
  const bad = validateAdminEmail({ sender: "ceo", to: "a@example.com, b@example.com", subject: "", body: "x".repeat(20_001) });
  assert.ok(!bad.ok);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["body", "sender", "subject", "to"]);
  assert.equal(validateAdminEmail({ sender: "orders", to: "a@example.com", subject: "s", body: "b", orderId: "ord1" }).ok, true);
});

test("sale push rings the kitvoy_sales channel with the custom sound at high priority", () => {
  const push = salePush({ id: "cmorder1", reference: "KTV-ABCDEFGH", customerName: "Sam Lee", total: 134.98, itemCount: 3 });
  assert.equal(push.title, "New sale · $134.98");
  assert.equal(push.body, "KTV-ABCDEFGH · Sam Lee · 3 items");
  const { message } = buildSaleMessage("device-token", push);
  assert.equal(message.token, "device-token");
  assert.deepEqual(message.notification, { title: push.title, body: push.body });
  assert.equal(message.android.priority, "HIGH");
  assert.equal(message.android.notification.channel_id, "kitvoy_sales");
  assert.equal(message.android.notification.sound, "notification");
  assert.equal(message.apns.payload.aps.sound, "notification.wav");
  assert.ok(Object.values(message.data).every(v => typeof v === "string"));
  assert.equal(salePush({ id: "x", reference: "KTV-1", customerName: "A", total: 59.99, itemCount: 1 }).body, "KTV-1 · A · 1 item");
});

// Saturday Oct 31 2026, noon in New York
const salesNow = new Date("2026-10-31T16:00:00Z");
const sale = (o: Partial<SalesOrder> & { createdAt: Date }): SalesOrder => ({
  total: 59.99, status: "CONFIRMED", paymentStatus: "paid", paymentFee: null, supplierStatus: null,
  supplierProductCost: null, supplierShippingCost: null, items: [{ productSlug: "cordless-tire-inflator", quantity: 1 }], ...o,
});

test("sales overview uses store days, the Mon–Sun week, same-day comparison and paid orders only", () => {
  const overview = computeSalesOverview([
    sale({ createdAt: new Date("2026-10-31T14:00:00Z"), paymentFee: 2.58, supplierProductCost: 12.94, supplierShippingCost: 15.32 }),
    // 23:30 Wednesday in New York, already Thursday in UTC
    sale({ createdAt: new Date("2026-10-29T03:30:00Z"), total: 101.98, items: [{ productSlug: "cordless-tire-inflator", quantity: 2 }] }),
    sale({ createdAt: new Date("2026-10-26T12:00:00Z"), status: "CANCELED" }),
    sale({ createdAt: new Date("2026-10-27T12:00:00Z"), paymentStatus: "refunded", paymentFee: 2.58, supplierStatus: "UNSHIPPED", supplierProductCost: 12.94, supplierShippingCost: 15.32 }),
    sale({ createdAt: new Date("2026-10-30T12:00:00Z"), paymentStatus: "unpaid" }),
    sale({ createdAt: new Date("2026-10-20T15:00:00Z") }),
    // Last Sunday: in the month, but not one of the days compared so far this week
    sale({ createdAt: new Date("2026-10-25T15:00:00Z") }),
    sale({ createdAt: new Date("2026-09-30T15:00:00Z") }),
  ], salesNow);

  assert.deepEqual(overview.today, { date: "2026-10-31", revenue: 59.99, orders: 1 });
  assert.equal(overview.week.start, "2026-10-26");
  assert.equal(overview.week.end, "2026-11-01");
  assert.deepEqual(overview.week.days.map(d => d.revenue), [0, 0, 101.98, 0, 0, 59.99, null]);
  assert.deepEqual(overview.week.days.map(d => d.label), ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
  assert.equal(overview.week.revenue, 161.97);
  assert.equal(overview.week.orders, 2);
  assert.equal(overview.week.previousRevenue, 59.99);
  assert.ok(Math.abs(overview.week.changePercent! - 170) <= 0.1);

  assert.equal(overview.month.label, "October 2026");
  assert.equal(overview.month.revenue, 281.95);
  assert.equal(overview.month.orders, 4);
  // 5 units at $12.94; shipping 15.32 recorded + 28.24 (2 units) + 2 × 15.32 estimated; fees 2.58 recorded + 4.05 + 2.58 + 2.58
  assert.deepEqual(overview.month.profit, {
    amount: 100.42, estimated: true, ordersWithEstimates: 3,
    productCost: 64.7, shippingCost: 74.2, paymentFees: 11.79, refundCosts: 30.84,
  });
});

test("profit is confirmed only when every order has recorded costs, and empty data is all zeros", () => {
  const recorded = computeSalesOverview([
    sale({ createdAt: new Date("2026-10-31T14:00:00Z"), paymentFee: 2.39, supplierProductCost: 12.94, supplierShippingCost: 15.32 }),
  ], salesNow);
  assert.equal(recorded.month.profit.estimated, false);
  assert.equal(recorded.month.profit.amount, 29.34);

  const empty = computeSalesOverview([], salesNow);
  assert.deepEqual(empty.week.days.map(d => d.revenue), [0, 0, 0, 0, 0, 0, null]);
  assert.equal(empty.week.changePercent, null);
  assert.equal(empty.today.revenue, 0);
  assert.deepEqual(empty.month.profit, { amount: 0, estimated: false, ordersWithEstimates: 0, productCost: 0, shippingCost: 0, paymentFees: 0, refundCosts: 0 });
});

test("FAQ, structured data and product copy state the published policies and only verified specs", async () => {
  const { storefrontFaqs } = await import("../src/lib/storefront-faq");
  const { productSchema, returnPolicySchema } = await import("../src/lib/seo/structured-data");
  const { productSeo, verifiedProductCopy } = await import("../src/config/seo");
  const faqList = storefrontFaqs(true, 59.99);
  const faqs = faqList.map(f => f.a).join(" ");
  const why = faqList.find(f => f.q === "Why buy from Kitvoy?")!.a;
  assert.match(why, /all 50 US states and Washington, DC/);
  assert.match(why, /30 days to return it unused in its original packaging/);
  assert.match(why, /damaged or defective, we replace it or refund you, return shipping included/);
  assert.match(faqs, /Two inflators cost \$99\.99 together, \$19\.99 less/);
  assert.match(faqs, /Three cost \$134\.98, which saves \$44\.99/);
  assert.doesNotMatch(storefrontFaqs(true).map(f => f.a).join(" "), /\$/, "without a price the FAQ names no dollar amounts");
  assert.doesNotMatch(faqs, /amazon|cheaper than|premium|best[- ]selling|#1|most popular/i);
  assert.match(faqs, /1–2 business days/);
  assert.match(faqs, /4–9 business days/);
  assert.match(faqs, /within 30 days of delivery/);
  assert.match(faqs, /support@kitvoy\.com/);
  assert.doesNotMatch(faqs, /not yet (been )?published/);

  const offer = productSchema({ ...product, slug: "cordless-tire-inflator", sku: "INF-001", images: ["/uploads/a.jpg"] }).offers;
  assert.deepEqual([offer.shippingDetails.deliveryTime.handlingTime.minValue, offer.shippingDetails.deliveryTime.handlingTime.maxValue], [1, 2]);
  assert.deepEqual([offer.shippingDetails.deliveryTime.transitTime.minValue, offer.shippingDetails.deliveryTime.transitTime.maxValue], [4, 9]);
  assert.equal(returnPolicySchema().merchantReturnDays, 30);

  const unverified = /usb-c|\bsos\b|shut(s)? (itself )?off|stops by itself|auto(matic)?[ -]?(shut|stop)|presta|ball-needle/i;
  for (const text of [productSeo.summary, productSeo.description, faqs, ...Object.values(verifiedProductCopy)]) assert.doesNotMatch(text, unverified);
});

const confirmationPayload = {
  to: "sam@example.com", customerName: "Sam <script>Lee</script>", orderReference: "KTV-ABCD1234",
  orderDate: new Date("2026-11-01T15:00:00Z"),
  items: [{ productName: "Cordless Tire Inflator", quantity: 2, lineTotal: 101.98 }],
  subtotal: 101.98, shippingCost: 0, total: 101.98, paymentMethod: "paypal",
  shipTo: ["Sam Lee", "123 Test St, Apt 4", "Washington, DC 20001"],
};

test("order confirmation email shows the reference, items, total, address and delivery timeline, escaped", async () => {
  const { buildOrderConfirmationEmail } = await import("../src/lib/email");
  const { subject, text, html } = buildOrderConfirmationEmail(confirmationPayload);
  assert.equal(subject, "Your Kitvoy order KTV-ABCD1234 is confirmed");
  for (const body of [text, html]) {
    assert.match(body, /KTV-ABCD1234/);
    assert.match(body, /2 × Cordless Tire Inflator/);
    assert.match(body, /\$101\.98/);
    assert.match(body, /Washington, DC 20001/);
    assert.match(body, /1–2 business days/);
    assert.match(body, /4–9 business days with CJPacket/);
    assert.match(body, /support@kitvoy\.com/);
    assert.match(body, /November 1, 2026/);
  }
  assert.ok(!html.includes("<script>"), "customer name must be escaped");
  assert.match(html, /Sam/);
});

function fakeConfirmationDeps(sendResults: { sent: boolean; reason?: string }[]) {
  let claimed = false;
  const calls = { sends: 0, waits: [] as number[], records: [] as boolean[], releases: 0 };
  const deps = {
    claim: async () => { if (claimed) return false; claimed = true; return true; },
    release: async () => { claimed = false; calls.releases++; },
    load: async () => confirmationPayload,
    send: async () => (sendResults[calls.sends++] ?? sendResults[sendResults.length - 1]) as { sent: true } | { sent: false; reason: string },
    record: async (_id: string, _p: unknown, r: { sent: boolean }) => { calls.records.push(r.sent); },
    wait: async (ms: number) => { calls.waits.push(ms); },
  };
  return { deps, calls };
}

test("order confirmation is sent once per order, retries a failed send, and frees the claim if it gives up", async () => {
  const { deliverOrderConfirmation, RETRY_DELAYS_MS } = await import("../src/lib/order-confirmation");

  const ok = fakeConfirmationDeps([{ sent: true }]);
  assert.deepEqual(await deliverOrderConfirmation("o1", ok.deps), { sent: true });
  const again = await deliverOrderConfirmation("o1", ok.deps);
  assert.equal(again.sent, false, "a second call must not send");
  assert.equal(ok.calls.sends, 1);
  assert.deepEqual(ok.calls.records, [true]);
  assert.equal(ok.calls.releases, 0);

  const flaky = fakeConfirmationDeps([{ sent: false, reason: "SMTP timeout" }, { sent: true }]);
  assert.deepEqual(await deliverOrderConfirmation("o2", flaky.deps), { sent: true });
  assert.equal(flaky.calls.sends, 2);
  assert.deepEqual(flaky.calls.waits, [RETRY_DELAYS_MS[0]]);
  assert.deepEqual(flaky.calls.records, [true]);

  const down = fakeConfirmationDeps([{ sent: false, reason: "SMTP down" }]);
  const failed = await deliverOrderConfirmation("o3", down.deps);
  assert.equal(failed.sent, false);
  assert.equal(down.calls.sends, 1 + RETRY_DELAYS_MS.length);
  assert.deepEqual(down.calls.records, [false], "the failure is logged once");
  assert.equal(down.calls.releases, 1, "the claim is released so it can be retried");

  const broken = fakeConfirmationDeps([{ sent: true }]);
  broken.deps.load = async () => { throw new Error("database unavailable"); };
  assert.equal((await deliverOrderConfirmation("o4", broken.deps)).sent, false, "errors are returned, never thrown");
  assert.equal(broken.calls.releases, 1, "a claim taken before an error is released");
});

test("terms name New Mexico as the governing law", async () => {
  const { storePolicies } = await import("../src/config/policies");
  assert.equal(storePolicies.governingLaw, "the State of New Mexico, United States");
});

test("Google sign-in only returns to same-site paths", async () => {
  const { safeRedirectPath } = await import("../src/lib/auth/google-oauth");
  assert.equal(safeRedirectPath("/checkout"), "/checkout");
  assert.equal(safeRedirectPath("/account/orders?tab=1"), "/account/orders?tab=1");
  for (const bad of ["//evil.com", "/\\evil.com", "https://evil.com", "evil.com", "/\tevil", "", null, undefined]) {
    assert.equal(safeRedirectPath(bad), "/account", String(bad));
  }
});

test("Google sign-in request uses PKCE and a state the callback must match", async () => {
  const { createGoogleAuthRequest, readGoogleStateCookie, statesMatch } = await import("../src/lib/auth/google-oauth");
  const { createHash } = await import("node:crypto");
  const { url, cookie } = createGoogleAuthRequest("client-id", "https://kitvoy.com/api/auth/google/callback", "//evil.com");
  const params = new URL(url).searchParams;
  const saved = readGoogleStateCookie(cookie)!;
  assert.equal(params.get("redirect_uri"), "https://kitvoy.com/api/auth/google/callback");
  assert.equal(params.get("scope"), "openid email profile");
  assert.equal(params.get("code_challenge_method"), "S256");
  assert.equal(params.get("code_challenge"), createHash("sha256").update(saved.verifier).digest("base64url"));
  assert.equal(params.get("access_type"), null);
  assert.equal(saved.redirect, "/account");
  assert.ok(statesMatch(saved.state, params.get("state")));
  assert.ok(!statesMatch(saved.state, "forged"));
  assert.ok(!statesMatch(saved.state, null));
  assert.equal(readGoogleStateCookie("not-a-cookie"), null);
  assert.notEqual(readGoogleStateCookie(createGoogleAuthRequest("c", "r", "/").cookie)!.state, saved.state);
});

test("Google accounts need a verified email before they can sign in or link", async () => {
  const { checkGoogleProfile, googleErrorCode } = await import("../src/lib/auth/google-oauth");
  assert.deepEqual(checkGoogleProfile({ sub: "1", email: "Sam@Example.com", email_verified: true, name: "Sam Lee", picture: "https://lh3.googleusercontent.com/a" }),
    { ok: true, profile: { googleId: "1", email: "sam@example.com", fullName: "Sam Lee", image: "https://lh3.googleusercontent.com/a" } });
  assert.deepEqual(checkGoogleProfile({ sub: "1", email: "sam@example.com", email_verified: false }), { ok: false, error: "google_unverified" });
  assert.deepEqual(checkGoogleProfile({ sub: "1", email: "sam@example.com" }), { ok: false, error: "google_unverified" });
  assert.deepEqual(checkGoogleProfile({ email: "sam@example.com", email_verified: true }), { ok: false, error: "google_profile_failed" });
  assert.equal(checkGoogleProfile({ sub: "2", email: "pat@example.com", email_verified: true }).ok && "pat", "pat");
  assert.equal(googleErrorCode("google_state"), "google_state");
  assert.equal(googleErrorCode("google_token_failed"), "google_failed");
  assert.equal(googleErrorCode("something_else"), undefined);
});

test("reviews show first name and last initial, and only paid, uncanceled orders count as verified", async () => {
  const { reviewerName, isVerifiedPurchase, summarizeRatings, parseReviewInput, isReviewUpload } = await import("../src/lib/reviews");
  assert.equal(reviewerName("sam lee"), "Sam L.");
  assert.equal(reviewerName("  Maria  de la  Cruz "), "Maria C.");
  assert.equal(reviewerName("Pat"), "Pat");
  assert.equal(reviewerName(""), "Kitvoy customer");
  assert.equal(isVerifiedPurchase({ paymentStatus: "paid", status: "DELIVERED" }), true);
  assert.equal(isVerifiedPurchase({ paymentStatus: "refunded", status: "DELIVERED" }), true);
  assert.equal(isVerifiedPurchase({ paymentStatus: "unpaid", status: "PENDING" }), false);
  assert.equal(isVerifiedPurchase({ paymentStatus: "paid", status: "CANCELED" }), false);
  assert.equal(isVerifiedPurchase(null), false);

  assert.deepEqual(summarizeRatings([]), { count: 0, average: 0, distribution: [0, 0, 0, 0, 0] });
  assert.deepEqual(summarizeRatings([{ rating: 5, count: 3 }, { rating: 4, count: 1 }, { rating: 2, count: 1 }]), { count: 5, average: 4.2, distribution: [3, 1, 0, 1, 0] });

  const form = (rating: string, comment: string) => { const f = new FormData(); f.set("rating", rating); f.set("comment", comment); return f; };
  assert.deepEqual(parseReviewInput(form("5", "  Works well. \r\n ")), { ok: true, rating: 5, comment: "Works well." });
  assert.deepEqual(parseReviewInput(form("0", "ok")), { ok: false, error: "reviews.ratingRequired" });
  assert.deepEqual(parseReviewInput(form("4.5", "ok")), { ok: false, error: "reviews.ratingRequired" });
  assert.deepEqual(parseReviewInput(form("4", "   ")), { ok: false, error: "reviews.commentRequired" });
  assert.deepEqual(parseReviewInput(form("4", "x".repeat(2001))), { ok: false, error: "reviews.commentTooLong" });
  assert.ok(isReviewUpload("/uploads/reviews/review-123.jpg"));
  for (const bad of ["https://evil.com/a.jpg", "/uploads/products/a.jpg", "/uploads/reviews/../x.jpg", "javascript:alert(1)"]) assert.ok(!isReviewUpload(bad), bad);
});

test("review links are signed per order and reject tampering", async () => {
  const { createReviewToken, readReviewToken } = await import("../src/lib/review-links");
  const secret = "s".repeat(40);
  const orderId = "cmh1abcdefghijklmnopqrstu";
  const token = createReviewToken(orderId, secret);
  assert.equal(readReviewToken(token, secret), orderId);
  assert.equal(readReviewToken(token, "t".repeat(40)), null, "another secret must not verify");
  assert.equal(readReviewToken(token.replace(orderId, "cmh1abcdefghijklmnopqrstv"), secret), null, "the signature is bound to the order");
  assert.equal(readReviewToken(`${token}x`, secret), null);
  for (const bad of ["", ".", orderId, `${orderId}.`, "../x.y", null]) assert.equal(readReviewToken(bad, secret), null, String(bad));
  assert.equal(readReviewToken(token, null), null, "no secret configured means no valid links");
});

test("rating markup appears only with approved reviews and leaves the offer untouched", async () => {
  const { productSchema } = await import("../src/lib/seo/structured-data");
  const { REVIEWS_SHOWN_FIRST } = await import("../src/lib/reviews");
  const inflator = { ...product, slug: "cordless-tire-inflator", sku: "INF-001", images: ["/uploads/a.jpg"] };
  const plain = productSchema(inflator) as Record<string, unknown>;
  assert.ok(!("aggregateRating" in plain) && !("review" in plain));
  assert.deepEqual(productSchema(inflator, null), plain);

  const reviews = Array.from({ length: 8 }, (_, i) => ({
    id: `r${i}`, rating: i === 0 ? 4 : 5, comment: `Review ${i}`, images: [], author: "Sam L.", verified: true,
    createdAt: "2026-11-01T15:00:00.000Z", publishedOn: "2026-11-01",
  }));
  const withReviews = productSchema(inflator, { count: 8, average: 4.9, distribution: [7, 1, 0, 0, 0], reviews }) as Record<string, unknown>;
  assert.deepEqual(withReviews.offers, plain.offers, "price, offer and shipping fields are unchanged");
  assert.deepEqual(withReviews.aggregateRating, { "@type": "AggregateRating", ratingValue: 4.9, reviewCount: 8, bestRating: 5, worstRating: 1 });
  const marked = withReviews.review as { author: { name: string }; datePublished: string; reviewBody: string; reviewRating: { ratingValue: number } }[];
  assert.equal(marked.length, REVIEWS_SHOWN_FIRST, "markup lists the reviews shown before Show more");
  assert.deepEqual([marked[0].author.name, marked[0].datePublished, marked[0].reviewBody, marked[0].reviewRating.ratingValue], ["Sam L.", "2026-11-01", "Review 0", 4]);
});

const reviewRequestPayload = {
  to: "sam@example.com", customerName: "Sam <b>Lee</b>", orderReference: "KTV-ABCD1234", productName: "Cordless Tire Inflator",
  deliveredAt: new Date("2026-11-02T18:00:00Z"), reviewUrl: "https://kitvoy.com/review/abc.def",
};

test("review request email links to the form, offers every star rating and asks for honest reviews", async () => {
  const { buildReviewRequestEmail } = await import("../src/lib/email");
  const { subject, text, html } = buildReviewRequestEmail(reviewRequestPayload);
  assert.equal(subject, "How's your cordless tire inflator working?");
  assert.match(text, /Write your review: https:\/\/kitvoy\.com\/review\/abc\.def/);
  for (const body of [text, html]) {
    assert.match(body, /KTV-ABCD1234/);
    assert.match(body, /delivered on November 2/);
    assert.match(body, /good or bad/);
    assert.match(body, /within 30 days of delivery/);
  }
  for (const n of [1, 2, 3, 4, 5]) assert.ok(html.includes(`https://kitvoy.com/review/abc.def?rating=${n}`), `star ${n}`);
  assert.ok(!html.includes("<b>Lee"), "customer name must be escaped");
  assert.doesNotMatch(subject, /—/);
});

test("review requests go out once per order, a few days after delivery, and a failed send is retried later", async () => {
  const { deliverReviewRequest, sendDueReviewRequests, reviewRequestWindow } = await import("../src/lib/review-requests");
  const { REVIEW_REQUEST_DELAY_DAYS, REVIEW_REQUEST_MAX_LATE_DAYS, reviewRequestStatus } = await import("../src/lib/reviews");
  const now = new Date("2026-11-20T16:00:00Z");
  const window = reviewRequestWindow(now);
  const day = 86_400_000;
  assert.equal(now.getTime() - window.deliveredBy.getTime(), REVIEW_REQUEST_DELAY_DAYS * day);
  assert.equal(now.getTime() - window.deliveredFrom.getTime(), (REVIEW_REQUEST_DELAY_DAYS + REVIEW_REQUEST_MAX_LATE_DAYS) * day);

  const claimed = new Set<string>();
  const calls = { sends: 0, records: [] as boolean[], releases: 0 };
  let nextSend: { sent: true } | { sent: false; reason: string } = { sent: true };
  const deps = {
    dueOrderIds: async () => ["o1"],
    claim: async (id: string) => { if (claimed.has(id)) return false; claimed.add(id); return true; },
    release: async (id: string) => { claimed.delete(id); calls.releases++; },
    load: async () => reviewRequestPayload,
    send: async () => { calls.sends++; return nextSend; },
    record: async (_id: string, _p: unknown, r: { sent: boolean }) => { calls.records.push(r.sent); },
  };
  assert.deepEqual(await sendDueReviewRequests(now, deps), { due: 1, sent: 1, failed: [] });
  assert.equal((await deliverReviewRequest("o1", deps)).sent, false, "a second run must not email again");
  assert.equal(calls.sends, 1);

  nextSend = { sent: false, reason: "SMTP down" };
  assert.equal((await deliverReviewRequest("o2", deps)).sent, false);
  assert.equal(calls.releases, 1, "the claim is released so tomorrow's run retries");
  assert.deepEqual(calls.records, [true, false]);
  nextSend = { sent: true };
  assert.equal((await deliverReviewRequest("o2", deps)).sent, true);

  const delivered = new Date("2026-11-10T12:00:00Z");
  assert.equal(reviewRequestStatus({ deliveredAt: null, reviewRequestSentAt: null, hasReview: false, hasEmail: true }, now), null);
  assert.match(reviewRequestStatus({ deliveredAt: delivered, reviewRequestSentAt: null, hasReview: false, hasEmail: true }, new Date("2026-11-11T12:00:00Z"))!, /will be emailed on Nov 14, 2026/);
  assert.match(reviewRequestStatus({ deliveredAt: delivered, reviewRequestSentAt: new Date("2026-11-14T16:00:00Z"), hasReview: false, hasEmail: true }, now)!, /emailed Nov 14, 2026/);
  assert.match(reviewRequestStatus({ deliveredAt: new Date("2026-09-01T12:00:00Z"), reviewRequestSentAt: null, hasReview: false, hasEmail: true }, now)!, /too long ago/);
});

test("My orders offers a review only for delivered paid orders, until every product is reviewed", async () => {
  const { orderReviewState } = await import("../src/lib/reviews");
  const delivered = { status: "DELIVERED", paymentStatus: "paid", fulfillmentStatus: "DELIVERED", items: [{ productId: "p1" }, { productId: "p1" }, { productId: null }], reviews: [] as { productId: string }[] };
  assert.equal(orderReviewState(delivered), "open");
  assert.equal(orderReviewState({ ...delivered, reviews: [{ productId: "p1" }] }), "done");
  assert.equal(orderReviewState({ ...delivered, status: "SHIPPED", fulfillmentStatus: "SHIPPED" }), null, "not before delivery");
  assert.equal(orderReviewState({ ...delivered, status: "DELIVERED", fulfillmentStatus: "SHIPPED" }), "open", "an order marked delivered by hand counts");
  assert.equal(orderReviewState({ ...delivered, paymentStatus: "unpaid" }), null);
  assert.equal(orderReviewState({ ...delivered, status: "CANCELED" }), null);
  assert.equal(orderReviewState({ ...delivered, items: [{ productId: null }] }), null, "nothing reviewable");
});

test("Meta Pixel Purchase sends the paid total in USD with the order reference, and skips admin pages", async () => {
  const { trackPurchase, isUntrackedPath, hasPrivacyOptOut } = await import("../src/lib/analytics/meta-pixel");
  const calls: unknown[][] = [];
  const g = globalThis as unknown as { window?: { fbq?: (...a: unknown[]) => void } };
  const hadWindow = "window" in g;
  g.window = { fbq: (...a: unknown[]) => { calls.push(a); } };
  try {
    trackPurchase({ orderReference: "KTV-ABCD1234", value: 99.99, skus: ["INF-001"], quantity: 2 });
    assert.deepEqual(calls, [["track", "Purchase", { currency: "USD", value: 99.99, content_ids: ["INF-001"], content_type: "product", num_items: 2 }, { eventID: "KTV-ABCD1234" }]]);
    g.window = {};
    assert.doesNotThrow(() => trackPurchase({ orderReference: "KTV-X", value: 1, skus: [], quantity: 1 }), "no pixel loaded (opted out) is a no-op");
  } finally {
    if (!hadWindow) delete g.window;
  }
  assert.equal(isUntrackedPath("/admin/orders"), true);
  assert.equal(isUntrackedPath("/checkout"), false);
  assert.equal(typeof hasPrivacyOptOut(), "boolean");
});
