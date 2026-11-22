import test from "node:test";
import assert from "node:assert/strict";
import { getLineTotal, getBundleSavings } from "../src/lib/bundles";
import { validateCheckoutDetails, toShippingAddress, type CheckoutDetails } from "../src/lib/us-address";
import { useCartStore, getShippingForItems } from "../src/store/cart-store";
import type { ProductDisplay } from "../src/types/product";
import { buildSaleMessage } from "../src/lib/push/fcm";
import { salePush } from "../src/lib/push/admin-devices";
import { computeSalesOverview, type SalesOrder } from "../src/lib/data/sales-overview";

const product: ProductDisplay = { id: "unit-test", slug: "inflator", name: "Inflator", shortDescription: "", description: "", details: "", price: 59.99, shippingTax: 0, rating: 0, reviewCount: 0, stock: 9, sku: "TEST", isFeatured: false, category: { id: "test", slug: "test", name: "Test" }, images: [] };
const valid: CheckoutDetails = { email: "test@example.com", fullName: "Test Customer", phone: "2025550143", address1: "123 Test St", address2: "", city: "Washington", state: "DC", zip: "20001" };

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
const sale = (o: Partial<SalesOrder> & { createdAt: Date }): SalesOrder => ({ total: 59.99, status: "DELIVERED", ...o });
// No costs are recorded any more: the profit keys stay for the admin app, at zero
const noProfit = { amount: 0, estimated: false, ordersWithEstimates: 0, productCost: 0, shippingCost: 0, paymentFees: 0, refundCosts: 0 };

test("sales overview uses store days, the Mon–Sun week, same-day comparison and delivered orders only", () => {
  const overview = computeSalesOverview([
    sale({ createdAt: new Date("2026-10-31T14:00:00Z") }),
    // 23:30 Wednesday in New York, already Thursday in UTC
    sale({ createdAt: new Date("2026-10-29T03:30:00Z"), total: 101.98 }),
    sale({ createdAt: new Date("2026-10-26T12:00:00Z"), status: "CANCELED" }),
    sale({ createdAt: new Date("2026-10-27T12:00:00Z"), status: "SHIPPED" }),
    sale({ createdAt: new Date("2026-10-30T12:00:00Z"), status: "PENDING" }),
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
  assert.deepEqual(overview.month.profit, noProfit);
});

test("a sales overview with no orders is all zeros", () => {
  const empty = computeSalesOverview([], salesNow);
  assert.deepEqual(empty.week.days.map(d => d.revenue), [0, 0, 0, 0, 0, 0, null]);
  assert.equal(empty.week.changePercent, null);
  assert.equal(empty.today.revenue, 0);
  assert.deepEqual(empty.month.profit, noProfit);
});

test("the Organization markup adds business identity only when Store settings publish it", async () => {
  const { organizationSchema } = await import("../src/lib/seo/structured-data");
  const bare = organizationSchema() as Record<string, unknown>;
  assert.deepEqual(Object.keys(bare), ["@type", "@id", "name", "url", "logo", "hasMerchantReturnPolicy"]);
  const emailOnly = organizationSchema({ supportEmail: "support@kitvoy.com", legalName: "  ", address: "", sameAs: ["", "not a url"] }) as Record<string, unknown>;
  assert.deepEqual(Object.keys(emailOnly), ["@type", "@id", "name", "url", "logo", "hasMerchantReturnPolicy", "email", "contactPoint"], "blank fields publish nothing");
  assert.deepEqual(emailOnly.contactPoint, { "@type": "ContactPoint", contactType: "customer support", email: "support@kitvoy.com", areaServed: ["US", "GB", "DE", "FR", "NL", "ES", "MX", "CL"], availableLanguage: "en" });
  const full = organizationSchema({
    supportEmail: "support@kitvoy.com", supportPhone: "+1 505 555 0100", legalName: "Example Holdings LLC",
    address: "1 Main St, Santa Fe, NM 87501, United States", sameAs: ["https://www.facebook.com/kitvoy", "", "http://insecure.example"],
  }) as Record<string, unknown>;
  assert.equal(full.legalName, "Example Holdings LLC");
  assert.equal(full.address, "1 Main St, Santa Fe, NM 87501, United States");
  assert.equal(full.telephone, "+1 505 555 0100");
  assert.deepEqual(full.sameAs, ["https://www.facebook.com/kitvoy"], "only real https profile links");
  assert.equal((full.contactPoint as Record<string, unknown>).telephone, "+1 505 555 0100");
});

test("terms name New Mexico as the governing law", async () => {
  const { storePolicies } = await import("../src/config/policies");
  assert.equal(storePolicies.governingLaw, "the State of New Mexico, United States");
});

test("Meta Pixel events carry an event_id, Purchase counts once per order, and admin pages are skipped", async () => {
  const pixel = await import("../src/lib/analytics/meta-pixel");
  const calls: unknown[][] = [];
  const store = new Map<string, string>();
  const g = globalThis as unknown as { window?: object; localStorage?: object };
  const hadWindow = "window" in g;
  const hadStorage = "localStorage" in g;
  g.window = { fbq: (...a: unknown[]) => { calls.push(a); } };
  g.localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
  try {
    // Two for $99.99: each unit is reported at what it cost in the bundle, not at the single price
    const contents = [{ id: "INF-001", quantity: 2, item_price: 50 }];
    assert.equal(pixel.trackPurchase({ orderReference: "KTV-ABCD1234", value: 99.99, contents }), true);
    assert.deepEqual(calls, [["track", "Purchase", { currency: "USD", value: 99.99, content_ids: ["INF-001"], content_type: "product", contents, num_items: 2, order_id: "KTV-ABCD1234" }, { eventID: "KTV-ABCD1234" }]]);
    assert.equal(pixel.trackPurchase({ orderReference: "KTV-ABCD1234", value: 99.99, contents }), false, "a refreshed thank-you page never counts the order again");
    assert.equal(calls.length, 1);

    const pair = [{ product: { id: "p1", sku: "INF-001", name: "Inflator", price: 59.99 }, quantity: 2 }];
    assert.equal(pixel.trackInitiateCheckout("KTV-ABCD1234", pair, 99.99), true);
    const ic = calls[1] as [string, string, Record<string, unknown>, { eventID: string }];
    assert.equal(ic[1], "InitiateCheckout");
    assert.deepEqual(ic[2], { currency: "USD", value: 99.99, content_ids: ["INF-001"], content_type: "product", contents, num_items: 2 });
    assert.equal(ic[3].eventID, "KTV-ABCD1234", "InitiateCheckout uses the order reference as its event_id");
    assert.equal(pixel.trackInitiateCheckout("KTV-ABCD1234", pair, 99.99), false, "saving the same checkout again never counts twice");
    assert.equal(calls.length, 2);

    pixel.trackAddToCart([{ product: { id: "p1", sku: "INF-001", name: "Inflator", price: 59.99 }, quantity: 1 }], 59.99);
    pixel.trackViewContent({ id: "p1", sku: "INF-001", name: "Inflator", price: 59.99 });
    assert.deepEqual(calls.slice(2).map((c) => c[1]), ["AddToCart", "ViewContent"]);
    for (const c of calls) {
      assert.equal(typeof c[1], "string");
      assert.ok((c[1] as string).length > 0, "no event may go out without a name");
      assert.ok(typeof (c[3] as { eventID?: string }).eventID === "string" && (c[3] as { eventID: string }).eventID.length > 0, "every event has an event_id");
    }
    assert.equal(pixel.track("" as never), null, "an empty event name is refused, not sent as __missing_event");
    assert.equal(calls.length, 4);

    g.window = {};
    assert.equal(pixel.trackPurchase({ orderReference: "KTV-X", value: 1, contents: [] }), false, "no pixel loaded (opted out) is a no-op");
  } finally {
    if (!hadWindow) delete g.window;
    if (!hadStorage) delete g.localStorage;
  }
  assert.equal(pixel.isUntrackedPath("/admin/orders"), true);
  assert.equal(pixel.isUntrackedPath("/checkout"), false);
  assert.equal(typeof pixel.hasPrivacyOptOut(), "boolean");
});

test("Conversions API user_data is normalised and hashed the way Meta requires, browser ids left in clear", async () => {
  const capi = await import("../src/lib/analytics/meta-capi");
  const { createHash } = await import("node:crypto");
  const sha = (v: string) => createHash("sha256").update(v).digest("hex");
  assert.equal(capi.normalizeEmail("  Jane.Doe@Example.COM "), "jane.doe@example.com");
  assert.equal(capi.normalizePhone("(202) 555-0143"), "12025550143", "US numbers get the country code");
  assert.equal(capi.normalizePhone("+1 202 555 0143"), "12025550143");
  assert.equal(capi.normalizeName("O'Brien-Smith "), "obriensmith");
  assert.equal(capi.normalizeName("St. Louis"), "stlouis");
  assert.equal(capi.normalizeState("DC"), "dc");
  assert.equal(capi.normalizeZip("20001-1234"), "20001");
  assert.deepEqual(capi.splitName("Jane Q. Public"), { first: "Jane", last: "Public" });

  const user = capi.buildUserData(
    { email: "Jane@Example.com", phone: "(202) 555-0143", fullName: "Jane Public", city: "Washington", state: "DC", zip: "20001-1234", country: "US", externalId: "user_1" },
    { fbp: "fb.1.1700000000000.123456789", fbc: "fb.1.1700000000000.AbC-123", clientIp: "203.0.113.9", userAgent: "Mozilla/5.0" },
  );
  assert.deepEqual(user, {
    em: [sha("jane@example.com")],
    ph: [sha("12025550143")],
    fn: [sha("jane")],
    ln: [sha("public")],
    ct: [sha("washington")],
    st: [sha("dc")],
    zp: [sha("20001")],
    country: [sha("us")],
    external_id: [sha("user_1")],
    client_ip_address: "203.0.113.9",
    client_user_agent: "Mozilla/5.0",
    fbc: "fb.1.1700000000000.AbC-123",
    fbp: "fb.1.1700000000000.123456789",
  });
  const sparse = capi.buildUserData({ phone: "12" }, {});
  assert.deepEqual(Object.keys(sparse), ["country"], "unknown fields are left out rather than hashed empty");
  const origin = (process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://kitvoy.com").replace(/\/$/, "");
  assert.equal(capi.toEventSourceUrl("/checkout?x=1", "/checkout"), `${origin}/checkout?x=1`);
  assert.equal(capi.toEventSourceUrl("https://evil.example/", "/checkout"), `${origin}/checkout`, "only the store's own pages");
  assert.equal(capi.getMetaCapiConfig(), null, "no token in the test environment means nothing is sent");
});

test("ad attribution is read from the landing URL, kept in a first-party cookie and turned into Meta's fbc", async () => {
  const a = await import("../src/lib/analytics/attribution");
  const landing = a.attributionFromUrl(new URL("https://kitvoy.com/?utm_source=facebook&utm_medium=paid&utm_campaign=launch&utm_content=c1_tire_light_hook&fbclid=IwAR1abc_-x"), 1700000000000);
  assert.deepEqual(landing, {
    utm_source: "facebook", utm_medium: "paid", utm_campaign: "launch", utm_content: "c1_tire_light_hook",
    fbclid: "IwAR1abc_-x", fbclidAt: 1700000000000,
    landing: "/?utm_source=facebook&utm_medium=paid&utm_campaign=launch&utm_content=c1_tire_light_hook&fbclid=IwAR1abc_-x", at: 1700000000000,
  });
  assert.equal(a.attributionFromUrl(new URL("https://kitvoy.com/cart")), null, "no ad parameters, no cookie");
  assert.deepEqual(a.parseAttribution(a.serializeAttribution(landing!)), landing, "round-trips through the cookie");
  assert.equal(a.parseAttribution("not json"), null);
  assert.equal(a.buildFbc("IwAR1abc_-x", 1700000000000), "fb.1.1700000000000.IwAR1abc_-x");

  const cookies = new Map([[a.ATTRIBUTION_COOKIE, { value: a.serializeAttribution(landing!) }], ["_fbp", { value: "fb.1.1700000000000.42" }]]);
  const headers = new Headers({ "cf-connecting-ip": "203.0.113.9", "x-forwarded-for": "10.0.0.1, 203.0.113.9", "user-agent": "UA" });
  const order = a.readOrderAttribution({ get: (k) => cookies.get(k) }, headers);
  assert.deepEqual(order, {
    utm_source: "facebook", utm_medium: "paid", utm_campaign: "launch", utm_content: "c1_tire_light_hook",
    fbclid: "IwAR1abc_-x", landing: landing!.landing,
    fbp: "fb.1.1700000000000.42", fbc: "fb.1.1700000000000.IwAR1abc_-x", clientIp: "203.0.113.9", userAgent: "UA",
  });
  assert.equal(a.validFbp("garbage"), undefined);
});

test("robots.txt blocks only non-pages, so every noindex page stays readable to crawlers", async () => {
  const { default: robots } = await import("../src/app/robots");
  const { rules, sitemap } = robots();
  const rule = Array.isArray(rules) ? rules[0] : rules;
  assert.deepEqual(rule.disallow, ["/api/", "/cdn-cgi/"]);
  assert.equal(rule.allow, "/");
  assert.match(String(sitemap), /\/sitemap\.xml$/);

  const { readFile } = await import("node:fs/promises");
  // A noindex page blocked in robots.txt can't show its noindex; these must not be disallowed
  for (const file of ["src/app/admin/layout.tsx", "src/app/checkout/layout.tsx", "src/app/cart/layout.tsx", "src/app/not-found.tsx"]) {
    assert.match(await readFile(file, "utf8"), /robots: \{ index: false/, `${file} says noindex`);
  }
  const sitemapSource = await readFile("src/app/sitemap.ts", "utf8");
  assert.ok(!/["'`]\/(cart|checkout|login|register|account|admin|api|review)/.test(sitemapSource), "the sitemap lists no private or transactional URL");
  assert.ok(!sitemapSource.includes("updatedAt: true"), "lastmod must not follow product.updatedAt, which moves on every sale");
});

test("sitemap lastmod is a plain calendar day that no server time zone can shift", async () => {
  const { toIsoDay, latestDay } = await import("../src/lib/seo/lastmod");
  const { storePolicies } = await import("../src/config/policies");
  const { pageLastModified } = await import("../src/config/seo");
  assert.equal(toIsoDay("November 9, 2026"), "2026-11-09");
  assert.equal(toIsoDay("2026-11-02"), "2026-11-02");
  assert.equal(toIsoDay(new Date("2026-11-07T19:45:52.461Z")), "2026-11-07");
  assert.equal(toIsoDay("not a date"), undefined);
  assert.equal(toIsoDay(null), undefined);
  assert.equal(latestDay("2026-11-02", null, new Date("2026-11-07T19:45:52Z"), undefined), "2026-11-07");
  assert.equal(latestDay("2026-11-02", null), "2026-11-02");
  assert.equal(latestDay(null, undefined), undefined);
  assert.match(toIsoDay(storePolicies.effectiveDate) ?? "", /^\d{4}-\d{2}-\d{2}$/, "the policies' effective date is a real date");
  for (const day of Object.values(pageLastModified)) assert.match(day, /^\d{4}-\d{2}-\d{2}$/);
});
