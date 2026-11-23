import assert from "node:assert/strict";
import test from "node:test";

import type { OrderItem, Prisma } from "@prisma/client";

import { NEXT_STEPS, STATUS_LABELS, STATUS_LIST, formatRate, isRedirectError, itemsSummary, ordersHref, statusLabel } from "../src/components/admin/order-ui";
import {
  COD_STATUSES,
  addressLineOf,
  changedOnly,
  cityNamesMatching,
  clampOrderLimit,
  deleteOrderIn,
  detailsChange,
  isCodStatus,
  orderSearchConditions,
  parseOrderDetails,
  parseStatusFilter,
  phoneSearchDigits,
  referenceSearchSuffix,
  serializeOrder,
  setOrderStatusIn,
  statusChangeData,
  stockMoveFor,
  stockWarning,
  takeFromStock,
  unitsByProduct,
  updateOrderDetailsIn,
  type CodStatus,
  type OrderWithItems,
} from "../src/lib/data/admin-orders";
import { computeCodActivity, computeSalesOverview, type CodOrderFacts } from "../src/lib/data/sales-overview";

/*
 * The rules of the admin's orders that need no database: what a status sets,
 * what it does to the stock, what the search box understands, how an edit is
 * checked, the JSON an order is returned as, and the dashboard's figures. The
 * writes themselves run here against an in-memory stand-in for the database.
 */

const at = (iso: string) => new Date(iso);

const ORDER_ID = "cmi8zq3xk0005l4041a2b3c4d";

const item = (over: Partial<OrderItem> = {}): OrderItem => ({
  id: "item1",
  orderId: ORDER_ID,
  productId: "prod1",
  productName: "Soutien-gorge (Noir, XL)",
  productSlug: "sanadi",
  variantKey: "black-xl",
  unitPrice: 199,
  quantity: 2,
  lineTotal: 350,
  createdAt: at("2026-11-22T10:00:00Z"),
  ...over,
});

/** A new cash-on-delivery order as the checkout saves it: every column of the row. */
const order = (over: Partial<OrderWithItems> = {}): OrderWithItems => ({
  id: ORDER_ID,
  customerName: "Fatima Zahra",
  email: null,
  phone: "0612345678",
  location: "12 rue Al Massira, Maarif, Casablanca",
  city: "Casablanca",
  shippingAddress: { address1: "12 rue Al Massira, Maarif", city: "Casablanca", country: "MA" },
  status: "PENDING",
  subtotal: 549,
  shippingCost: 0,
  total: 549,
  currency: "MAD",
  locale: "ar",
  paymentMethod: "cod",
  paymentStatus: "unpaid",
  adminNote: null,
  confirmedAt: null,
  stockHeld: true,
  clientIp: "196.200.0.1",
  paymentRef: null,
  stripePaymentIntentId: null,
  paymentFee: null,
  refundedAmount: null,
  testPayment: false,
  confirmationEmailSentAt: null,
  fulfillmentRef: null,
  supplierStatus: null,
  supplierProductCost: null,
  supplierShippingCost: null,
  fulfillmentError: null,
  fulfillmentStatus: "UNFULFILLED",
  trackingNumber: null,
  shippedAt: null,
  deliveredAt: null,
  reviewRequestSentAt: null,
  utmSource: "facebook",
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  fbclid: null,
  attribution: null,
  metaPurchaseSentAt: null,
  userId: null,
  createdAt: at("2026-11-22T10:00:00Z"),
  updatedAt: at("2026-11-22T10:00:00Z"),
  items: [item(), item({ id: "item2", productName: "Soutien-gorge (Beige, M)", variantKey: "nude-m", quantity: 1, lineTotal: 199 })],
  ...over,
});

/* ------------------------------------------------------------------ */
/*  Statuses                                                           */
/* ------------------------------------------------------------------ */

test("an order can be given seven statuses, and PREPARING is not one of them", () => {
  assert.deepEqual([...COD_STATUSES], ["PENDING", "NO_ANSWER", "CONFIRMED", "SHIPPED", "DELIVERED", "RETURNED", "CANCELED"]);
  for (const status of COD_STATUSES) assert.equal(isCodStatus(status), true);
  for (const not of ["PREPARING", "pending", "", "REFUNDED", undefined, null, 3, {}]) assert.equal(isCodStatus(not), false, `${String(not)} is refused`);
});

test("the dashboard names every status, in the same order as the data layer", () => {
  assert.deepEqual(STATUS_LIST, [...COD_STATUSES]);
  assert.deepEqual(
    STATUS_LIST.map((s) => STATUS_LABELS[s]),
    ["New", "No answer", "Confirmed", "Shipped", "Delivered", "Returned", "Canceled"],
  );
  assert.equal(statusLabel("PENDING"), "New");
  assert.equal(statusLabel("PREPARING"), "PREPARING", "a status of the old store is shown as stored");
  assert.equal(statusLabel("constructor"), "constructor");
});

test("the one-tap buttons are the natural next steps of each status", () => {
  const steps = (status: CodStatus) => NEXT_STEPS[status].map((s) => [s.status, s.label]);
  assert.deepEqual(steps("PENDING"), [["CONFIRMED", "Confirmed"], ["NO_ANSWER", "No answer"], ["CANCELED", "Cancel"]]);
  assert.deepEqual(steps("NO_ANSWER"), [["CONFIRMED", "Confirmed"], ["CANCELED", "Cancel"]]);
  assert.deepEqual(steps("CONFIRMED"), [["SHIPPED", "Shipped"], ["CANCELED", "Cancel"]]);
  assert.deepEqual(steps("SHIPPED"), [["DELIVERED", "Delivered"], ["RETURNED", "Returned"]]);
  for (const done of ["DELIVERED", "RETURNED", "CANCELED"] as const) assert.deepEqual(NEXT_STEPS[done], [], `${done} only changes through "Change status"`);
});

test("a status filter names one status or several, and refuses what is not a status", () => {
  assert.deepEqual(parseStatusFilter(""), []);
  assert.deepEqual(parseStatusFilter(null), []);
  assert.deepEqual(parseStatusFilter(undefined), []);
  assert.deepEqual(parseStatusFilter("SHIPPED"), ["SHIPPED"]);
  assert.deepEqual(parseStatusFilter("pending"), ["PENDING"]);
  assert.deepEqual(parseStatusFilter("PENDING,NO_ANSWER"), ["PENDING", "NO_ANSWER"]);
  assert.deepEqual(parseStatusFilter(" pending , no_answer ,PENDING,"), ["PENDING", "NO_ANSWER"]);
  assert.equal(parseStatusFilter("PREPARING"), null);
  assert.equal(parseStatusFilter("PENDING,bogus"), null);
});

/* ------------------------------------------------------------------ */
/*  What a status sets                                                 */
/* ------------------------------------------------------------------ */

const now = at("2026-11-22T12:00:00Z");
const later = at("2026-11-23T09:00:00Z");
const fresh = { confirmedAt: null, shippedAt: null, deliveredAt: null };

test("CONFIRMED stamps the confirmation once; the order stays unpaid and unfulfilled", () => {
  assert.deepEqual(statusChangeData(fresh, "CONFIRMED", now), {
    status: "CONFIRMED",
    paymentStatus: "unpaid",
    fulfillmentStatus: "UNFULFILLED",
    confirmedAt: now,
    shippedAt: null,
    deliveredAt: null,
  });
  assert.equal(statusChangeData({ ...fresh, confirmedAt: now }, "CONFIRMED", later).confirmedAt, now, "the first confirmation time is kept");
});

test("SHIPPED stamps the shipment, and the confirmation if the call was skipped", () => {
  assert.deepEqual(statusChangeData(fresh, "SHIPPED", now), {
    status: "SHIPPED",
    paymentStatus: "unpaid",
    fulfillmentStatus: "SHIPPED",
    confirmedAt: now,
    shippedAt: now,
    deliveredAt: null,
  });
  const confirmedBefore = statusChangeData({ ...fresh, confirmedAt: now }, "SHIPPED", later);
  assert.equal(confirmedBefore.confirmedAt, now);
  assert.equal(confirmedBefore.shippedAt, later);
});

test("DELIVERED is when the cash is collected: paid, with every stamp set", () => {
  assert.deepEqual(statusChangeData(fresh, "DELIVERED", now), {
    status: "DELIVERED",
    paymentStatus: "paid",
    fulfillmentStatus: "DELIVERED",
    confirmedAt: now,
    shippedAt: now,
    deliveredAt: now,
  });
  const usual = statusChangeData({ confirmedAt: at("2026-11-20T10:00:00Z"), shippedAt: at("2026-11-21T10:00:00Z"), deliveredAt: null }, "DELIVERED", now);
  assert.deepEqual([usual.confirmedAt, usual.shippedAt, usual.deliveredAt], [at("2026-11-20T10:00:00Z"), at("2026-11-21T10:00:00Z"), now]);
  assert.equal(statusChangeData(usual, "DELIVERED", later).deliveredAt, now, "the first delivery time is kept");
});

test("any status but DELIVERED is unpaid with no delivery time, and going back keeps the earlier stamps", () => {
  const delivered = statusChangeData(fresh, "DELIVERED", now);
  for (const status of ["PENDING", "NO_ANSWER", "CONFIRMED", "SHIPPED", "RETURNED", "CANCELED"] as const) {
    const undone = statusChangeData(delivered, status, later);
    assert.equal(undone.status, status);
    assert.equal(undone.paymentStatus, "unpaid", `${status} is unpaid`);
    assert.equal(undone.deliveredAt, null, `${status} has no delivery time`);
    assert.equal(undone.confirmedAt, now, `${status} keeps the confirmation time`);
    assert.equal(undone.shippedAt, now, `${status} keeps the shipment time`);
    assert.equal(undone.fulfillmentStatus, status === "SHIPPED" ? "SHIPPED" : "UNFULFILLED");
  }
  // A new order that nobody answered, then canceled: nothing was ever stamped
  for (const status of ["PENDING", "NO_ANSWER", "RETURNED", "CANCELED"] as const) {
    assert.deepEqual(statusChangeData(fresh, status, now), { status, paymentStatus: "unpaid", fulfillmentStatus: "UNFULFILLED", ...fresh });
  }
});

test("asking for the status an order already has changes nothing", () => {
  for (const status of COD_STATUSES) {
    const once = statusChangeData(fresh, status, now);
    assert.deepEqual(statusChangeData(once, status, later), once, `${status} twice`);
    // What the database write is made of: no field differs, so nothing is written
    const row = { ...order(), ...once, stockHeld: stockMoveFor(true, status) !== "release" };
    const again = { ...statusChangeData(row, status, later), stockHeld: row.stockHeld };
    assert.equal(stockMoveFor(row.stockHeld, status), "none");
    assert.deepEqual(changedOnly(row, again), {});
  }
});

/* ------------------------------------------------------------------ */
/*  Stock                                                              */
/* ------------------------------------------------------------------ */

test("stock comes back on CANCELED and RETURNED, and leaves again when such an order is revived", () => {
  for (const status of COD_STATUSES) {
    const givesBack = status === "CANCELED" || status === "RETURNED";
    assert.equal(stockMoveFor(true, status), givesBack ? "release" : "none", `${status}, pieces held`);
    assert.equal(stockMoveFor(false, status), givesBack ? "none" : "take", `${status}, pieces given back`);
  }
});

test("a run of status changes moves each piece once, never twice and never below zero", () => {
  const units = 3;
  let stock = 10;
  let held = true; // placed: the pieces already left the stock
  const shortages: number[] = [];
  const set = (status: CodStatus) => {
    const move = stockMoveFor(held, status);
    if (move === "release") stock += units;
    if (move === "take") {
      const { taken, short } = takeFromStock(units, stock);
      stock -= taken;
      if (short) shortages.push(short);
    }
    if (move !== "none") held = move === "take";
  };

  for (const status of ["CONFIRMED", "CONFIRMED", "SHIPPED"] as const) set(status);
  assert.deepEqual([stock, held], [10, true], "an active order keeps its pieces");
  for (const status of ["CANCELED", "CANCELED", "RETURNED"] as const) set(status);
  assert.deepEqual([stock, held], [13, false], "given back once, whatever is asked again");
  for (const status of ["PENDING", "NO_ANSWER", "CONFIRMED"] as const) set(status);
  assert.deepEqual([stock, held], [10, true], "taken once when the order comes back");

  set("RETURNED");
  stock = 1; // the rest was sold meanwhile
  set("CONFIRMED");
  assert.deepEqual([stock, held, shortages], [0, true, [2]], "the change is allowed, the stock stops at zero and the shortage is reported");
});

test("taking from the stock never goes below zero", () => {
  assert.deepEqual(takeFromStock(3, 10), { taken: 3, short: 0 });
  assert.deepEqual(takeFromStock(3, 3), { taken: 3, short: 0 });
  assert.deepEqual(takeFromStock(3, 1), { taken: 1, short: 2 });
  assert.deepEqual(takeFromStock(3, 0), { taken: 0, short: 3 });
  assert.deepEqual(takeFromStock(3, -2), { taken: 0, short: 3 }, "a stock already below zero is left alone");
});

test("stock is counted per product: colours and sizes add up, lines without a product hold none", () => {
  const units = unitsByProduct([
    { productId: "p1", quantity: 2 },
    { productId: "p1", quantity: 1 },
    { productId: null, quantity: 5 },
    { productId: "p2", quantity: 4 },
  ]);
  assert.deepEqual([...units], [["p1", 3], ["p2", 4]]);
  assert.deepEqual([...unitsByProduct([])], []);
});

test("a shortage is told to the owner in words, and no shortage says nothing", () => {
  assert.equal(stockWarning([]), undefined);
  const warning = stockWarning([{ name: "Soutien-gorge", needed: 3, available: 1 }]);
  assert.match(warning ?? "", /Soutien-gorge: 3 needed, 1 in stock/);
  assert.match(warning ?? "", /restock before shipping/);
});

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */

test("a phone search finds a number however it was typed", () => {
  for (const typed of ["0612345678", "06 12 34 56 78", "06-12-34-56-78", "+212612345678", "+212 612-345678", "00212612345678", "212612345678", "+212 0612345678", "612345678", "٠٦١٢٣٤٥٦٧٨"]) {
    assert.equal(phoneSearchDigits(typed), "612345678", typed);
  }
  assert.equal(phoneSearchDigits("0612"), "612", "the start of a number");
  assert.equal(phoneSearchDigits("345678"), "345678", "the end of a number");
  assert.equal(phoneSearchDigits("(0522) 123"), "522123", "a fixed line");
  assert.equal(phoneSearchDigits("2123"), "2123", "212 followed by anything but 5, 6 or 7 is not the country code");
  for (const notAPhone of ["Fatima", "CHR-1A2B3C4D", "1A2B3C4D", "Casablanca 2", "", "   ", "06", "+212", "+2126", "12"]) {
    assert.equal(phoneSearchDigits(notAPhone), null, `"${notAPhone}"`);
  }
});

test("a reference search reads the whole reference or its last characters", () => {
  for (const typed of ["CHR-1A2B3C4D", "chr-1a2b3c4d", " CHR-1A2B3C4D ", "CHR 1A2B3C4D", "CHR1A2B3C4D", "1A2B3C4D", "1a2b3c4d"]) {
    assert.equal(referenceSearchSuffix(typed), "1a2b3c4d", typed);
  }
  assert.equal(referenceSearchSuffix("3C4D"), "3c4d");
  assert.equal(referenceSearchSuffix("CHR-3C4D"), "3c4d");
  assert.equal(referenceSearchSuffix("Chrifa"), "chrifa", "a name that starts like the prefix is not cut");
  for (const notAReference of ["4D", "Fatima Zahra", "06 12 34 56 78", "1A2B3C4D5", "CHR-", "فاطمة", ""]) {
    assert.equal(referenceSearchSuffix(notAReference), null, `"${notAReference}"`);
  }
});

test("a city search ignores accents and understands Arabic names", () => {
  assert.deepEqual(cityNamesMatching("fes"), ["Fès"]);
  assert.deepEqual(cityNamesMatching("FÈS"), ["Fès"]);
  assert.deepEqual(cityNamesMatching("sale"), ["Salé"]);
  assert.deepEqual(cityNamesMatching("kenitra"), ["Kénitra"]);
  assert.deepEqual(cityNamesMatching("tan tan"), ["Tan-Tan"]);
  assert.deepEqual(cityNamesMatching("mdiq"), ["M'diq"]);
  assert.deepEqual(cityNamesMatching("فاس"), ["Fès"]);
  assert.deepEqual(cityNamesMatching("الدار البيضاء"), ["Casablanca"]);
  assert.deepEqual(cityNamesMatching("اكادير"), ["Agadir"], "typed without the hamza");
  assert.deepEqual(cityNamesMatching("a"), [], "one letter names no city");
  assert.deepEqual(cityNamesMatching("Springfield"), []);
});

test("the search box looks in the reference, the name, the phone and the city", () => {
  assert.deepEqual(orderSearchConditions(""), []);
  assert.deepEqual(orderSearchConditions("   "), []);

  assert.deepEqual(orderSearchConditions("06 12 34 56 78"), [
    { customerName: { contains: "06 12 34 56 78", mode: "insensitive" } },
    { city: { contains: "06 12 34 56 78", mode: "insensitive" } },
    { phone: { contains: "612345678" } },
  ]);
  assert.deepEqual(orderSearchConditions("CHR-1A2B3C4D"), [
    { customerName: { contains: "CHR-1A2B3C4D", mode: "insensitive" } },
    { city: { contains: "CHR-1A2B3C4D", mode: "insensitive" } },
    { id: { endsWith: "1a2b3c4d", mode: "insensitive" } },
  ]);
  assert.deepEqual(orderSearchConditions("  Fatima   Zahra "), [
    { customerName: { contains: "Fatima Zahra", mode: "insensitive" } },
    { city: { contains: "Fatima Zahra", mode: "insensitive" } },
  ]);
  assert.deepEqual(orderSearchConditions("meknes"), [
    { customerName: { contains: "meknes", mode: "insensitive" } },
    { city: { contains: "meknes", mode: "insensitive" } },
    { city: { in: ["Meknès"] } },
    { id: { endsWith: "meknes", mode: "insensitive" } },
  ]);
});

test("a list returns 300 orders unless asked otherwise, and never more than 1000", () => {
  for (const unset of [undefined, null, "", "abc", "12abc", "-5", 0, -5, Number.NaN]) assert.equal(clampOrderLimit(unset), 300, String(unset));
  assert.equal(clampOrderLimit("50"), 50);
  assert.equal(clampOrderLimit(50), 50);
  assert.equal(clampOrderLimit(2.9), 2);
  assert.equal(clampOrderLimit("1000"), 1000);
  assert.equal(clampOrderLimit("5000"), 1000);
  assert.equal(clampOrderLimit(1e9), 1000);
});

/* ------------------------------------------------------------------ */
/*  The order as JSON                                                  */
/* ------------------------------------------------------------------ */

test("a serialized order keeps every column and its items, and adds the reference, the phone links and the piece count", () => {
  const row = order();
  const json = serializeOrder(row);

  assert.deepEqual(Object.keys(json).sort(), [...Object.keys(row), "reference", "phoneE164", "whatsappUrl", "itemsCount"].sort());
  for (const [key, value] of Object.entries(row)) assert.deepEqual(json[key as keyof typeof row], value, key);
  assert.equal(json.reference, "CHR-1A2B3C4D");
  assert.equal(json.phoneE164, "+212612345678");
  assert.equal(json.whatsappUrl, "https://wa.me/212612345678");
  assert.equal(json.itemsCount, 3);

  // The older app still reads the old store's columns
  for (const legacy of ["fulfillmentStatus", "paymentStatus", "email", "trackingNumber", "shippedAt", "location", "currency"]) {
    assert.ok(legacy in json, `${legacy} stays in the JSON`);
  }

  const wire = JSON.parse(JSON.stringify(json));
  assert.equal(wire.createdAt, "2026-11-22T10:00:00.000Z");
  assert.equal(wire.confirmedAt, null);
  assert.deepEqual(wire.shippingAddress, { address1: "12 rue Al Massira, Maarif", city: "Casablanca", country: "MA" });
  assert.deepEqual(
    wire.items.map((i: { productName: string; variantKey: string; quantity: number }) => [i.productName, i.variantKey, i.quantity]),
    [["Soutien-gorge (Noir, XL)", "black-xl", 2], ["Soutien-gorge (Beige, M)", "nude-m", 1]],
  );
});

test("a phone that is not Moroccan gives no international form and no WhatsApp link", () => {
  const json = serializeOrder(order({ phone: "2025550143", items: [] }));
  assert.equal(json.phoneE164, null);
  assert.equal(json.whatsappUrl, null);
  assert.equal(json.itemsCount, 0);
  assert.equal(json.phone, "2025550143", "the stored number is returned as it is");
});

/* ------------------------------------------------------------------ */
/*  Edits                                                              */
/* ------------------------------------------------------------------ */

const parsed = (input: Parameters<typeof parseOrderDetails>[0]) => {
  const result = parseOrderDetails(input);
  assert.ok(result.ok, result.ok ? "" : result.error);
  return result.data;
};
const refused = (input: Parameters<typeof parseOrderDetails>[0]) => {
  const result = parseOrderDetails(input);
  assert.equal(result.ok, false, `${JSON.stringify(input)} should be refused`);
  return result.ok ? "" : result.error;
};

test("an edit touches only the fields it sends, trimmed", () => {
  assert.deepEqual(parsed({}), {});
  assert.deepEqual(parsed({ adminNote: "  call after 6pm  " }), { adminNote: "call after 6pm" });
  assert.deepEqual(parsed({ customerName: "  Fatima   Zahra ", city: " Rabat ", address: " 4  rue  Oqba " }), {
    customerName: "Fatima Zahra",
    city: "Rabat",
    address: "4 rue Oqba",
  });
  assert.deepEqual(parsed({ address: "شارع ١٢" }), { address: "شارع 12" }, "digits as the checkout stores them");
});

test("an empty note or tracking number clears it", () => {
  assert.deepEqual(parsed({ adminNote: "", trackingNumber: "" }), { adminNote: null, trackingNumber: null });
  assert.deepEqual(parsed({ adminNote: "   ", trackingNumber: null }), { adminNote: null, trackingNumber: null });
  assert.deepEqual(parsed({ adminNote: null }), { adminNote: null });
});

test("a note holds 1000 characters, a tracking number 3 to 64 letters, digits, spaces and dashes", () => {
  assert.equal(parsed({ adminNote: "x".repeat(1000) }).adminNote?.length, 1000);
  assert.match(refused({ adminNote: "x".repeat(1001) }), /note is too long/);
  assert.match(refused({ adminNote: 12 }), /note must be text/);
  assert.equal(parsed({ adminNote: "line one\nline two" }).adminNote, "line one\nline two", "line breaks are kept");

  assert.deepEqual(parsed({ trackingNumber: "  AB-123  456 " }), { trackingNumber: "AB-123 456" });
  assert.equal(parsed({ trackingNumber: "A1B" }).trackingNumber, "A1B");
  assert.equal(parsed({ trackingNumber: "7".repeat(64) }).trackingNumber?.length, 64);
  for (const bad of ["ab", "7".repeat(65), "AB_123", "-AB123", "AB/123"]) assert.match(refused({ trackingNumber: bad }), /tracking number should be/, bad);
  assert.match(refused({ trackingNumber: 123456 }), /tracking number must be text/);
});

test("the phone of an edit must be Moroccan, and is stored in national form", () => {
  for (const typed of ["0612345678", "+212 612-345678", "00212612345678", "612345678", "06 12 34 56 78"]) {
    assert.deepEqual(parsed({ phone: typed }), { phone: "0612345678" }, typed);
  }
  for (const bad of ["", "12345", "0812345678", "+1 202 555 0143", 612345678, null]) assert.match(refused({ phone: bad }), /Moroccan phone number/, String(bad));
});

test("a name, a city and an address cannot be emptied or overlong", () => {
  assert.match(refused({ customerName: "   " }), /customer name can't be empty/);
  assert.match(refused({ customerName: "x".repeat(81) }), /customer name is too long \(80/);
  assert.match(refused({ customerName: null }), /customer name must be text/);
  assert.match(refused({ city: "" }), /city can't be empty/);
  assert.match(refused({ city: "x".repeat(61) }), /city is too long \(60/);
  assert.match(refused({ address: "" }), /address can't be empty/);
  assert.match(refused({ address: "x".repeat(201) }), /address is too long \(200/);
  assert.match(refused({ adminNote: "fine", phone: "nope" }), /Moroccan phone number/, "one bad field refuses the whole edit");
});

test("a new city or address rewrites the city, the one-line location and the structured address", () => {
  const row = order();
  assert.equal(addressLineOf(row), "12 rue Al Massira, Maarif");

  assert.deepEqual(detailsChange(row, { city: "Rabat" }), {
    city: "Rabat",
    location: "12 rue Al Massira, Maarif, Rabat",
    shippingAddress: { address1: "12 rue Al Massira, Maarif", city: "Rabat", country: "MA" },
  });
  assert.deepEqual(detailsChange(row, { address: "Appt 4, 9 bd Zerktouni", adminNote: "new address by phone" }), {
    adminNote: "new address by phone",
    city: "Casablanca",
    location: "Appt 4, 9 bd Zerktouni, Casablanca",
    shippingAddress: { address1: "Appt 4, 9 bd Zerktouni", city: "Casablanca", country: "MA" },
  });
  // Nothing about the address: the address columns are left alone
  assert.deepEqual(detailsChange(row, { adminNote: "called", phone: "0712345678" }), { adminNote: "called", phone: "0712345678" });
});

test("the address line is found on an order that only has its one-line location", () => {
  assert.equal(addressLineOf(order({ shippingAddress: null })), "12 rue Al Massira, Maarif");
  assert.equal(addressLineOf(order({ shippingAddress: null, city: null })), "12 rue Al Massira, Maarif, Casablanca");
  assert.equal(addressLineOf(order({ shippingAddress: { city: "Casablanca" } })), "12 rue Al Massira, Maarif");
  assert.deepEqual(detailsChange(order({ shippingAddress: null, city: null }), { city: "Salé" }), {
    city: "Salé",
    location: "12 rue Al Massira, Maarif, Casablanca, Salé",
    shippingAddress: { address1: "12 rue Al Massira, Maarif, Casablanca", city: "Salé", country: "MA" },
  });
});

test("saving what is already stored writes nothing", () => {
  const row = order({ adminNote: "called", trackingNumber: null });
  const same = detailsChange(row, { adminNote: "called", trackingNumber: null, customerName: "Fatima Zahra", phone: "0612345678", city: "Casablanca", address: "12 rue Al Massira, Maarif" });
  assert.deepEqual(changedOnly(row, same), {});
  // The database returns a JSON column's keys in its own order
  const reordered = order({ shippingAddress: { city: "Casablanca", country: "MA", address1: "12 rue Al Massira, Maarif" } });
  assert.deepEqual(changedOnly(reordered, detailsChange(reordered, { city: "Casablanca" })), {});

  assert.deepEqual(changedOnly(row, detailsChange(row, { adminNote: "no answer twice", customerName: "Fatima Zahra" })), { adminNote: "no answer twice" });
  assert.deepEqual(Object.keys(changedOnly(row, detailsChange(row, { city: "Rabat" }))).sort(), ["city", "location", "shippingAddress"]);
  assert.deepEqual(changedOnly({ at: at("2026-11-22T10:00:00Z") }, { at: at("2026-11-22T10:00:00Z") }), {}, "two dates for the same moment are the same");
});

/* ------------------------------------------------------------------ */
/*  The writes, against an in-memory stand-in for the database         */
/* ------------------------------------------------------------------ */

/**
 * Just enough of a Prisma transaction for the writes: orders and products kept
 * in memory, and a record of what was asked of them. It answers the way the
 * real client does for these calls; the SQL of the two row locks is only
 * checked for its shape.
 */
function fakeDb(orders: OrderWithItems[], products: { id: string; name: string; stock: number }[]) {
  const orderRows = new Map(orders.map((o) => [o.id, structuredClone(o)]));
  const productRows = new Map(products.map((p) => [p.id, { ...p }]));
  const calls: string[] = [];

  const tx = {
    async $queryRaw(strings: TemplateStringsArray, ...values: unknown[]) {
      const sql = strings.join("?");
      const id = String(values[0]);
      assert.match(sql, /^SELECT .+ WHERE "id" = \? FOR UPDATE$/, "a row is read under a lock, by its id, with the id as a parameter");
      if (sql.includes('FROM "orders"')) {
        calls.push("lock order");
        return orderRows.has(id) ? [{ id }] : [];
      }
      if (sql.includes('FROM "products"')) {
        calls.push(`lock product ${id}`);
        const product = productRows.get(id);
        return product ? [{ name: product.name, stock: product.stock }] : [];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
    order: {
      async findFirst({ where }: { where: { id: string; paymentMethod: string } }) {
        const row = orderRows.get(where.id);
        return row && row.paymentMethod === where.paymentMethod ? structuredClone(row) : null;
      },
      async update({ where, data }: { where: { id: string }; data: Record<string, unknown> }) {
        const row = orderRows.get(where.id);
        if (!row) throw new Error("No such order");
        calls.push(`update order: ${Object.keys(data).sort().join(", ")}`);
        Object.assign(row, data);
        return structuredClone(row);
      },
      async delete({ where }: { where: { id: string } }) {
        calls.push("delete order");
        orderRows.delete(where.id);
      },
    },
    product: {
      async updateMany({ where, data }: { where: { id: string }; data: { stock: { increment: number } } }) {
        const product = productRows.get(where.id);
        if (!product) return { count: 0 };
        calls.push(`stock ${where.id} +${data.stock.increment}`);
        product.stock += data.stock.increment;
        return { count: 1 };
      },
      async update({ where, data }: { where: { id: string }; data: { stock: { decrement: number } } }) {
        const product = productRows.get(where.id);
        if (!product) throw new Error("No such product");
        calls.push(`stock ${where.id} -${data.stock.decrement}`);
        product.stock -= data.stock.decrement;
        return product;
      },
    },
  };

  return {
    tx: tx as unknown as Prisma.TransactionClient,
    calls,
    /** The calls made since the last time this was asked */
    drain: () => calls.splice(0),
    order: (id = ORDER_ID) => orderRows.get(id),
    stock: (id = "prod1") => productRows.get(id)?.stock,
    setStock: (stock: number, id = "prod1") => {
      productRows.get(id)!.stock = stock;
    },
  };
}

const sanadi = { id: "prod1", name: "Soutien-gorge", stock: 10 };
const t1 = at("2026-11-22T12:00:00Z");
const t2 = at("2026-11-23T09:00:00Z");
const t3 = at("2026-11-24T16:00:00Z");

test("an order goes from the call to the door: each step writes its own columns and leaves the stock alone", async () => {
  const db = fakeDb([order()], [sanadi]);

  const confirmed = await setOrderStatusIn(db.tx, ORDER_ID, "CONFIRMED", t1);
  assert.ok(confirmed.ok);
  assert.deepEqual(db.drain(), ["lock order", "update order: confirmedAt, status"]);
  assert.deepEqual([confirmed.order.status, confirmed.order.confirmedAt, confirmed.order.paymentStatus], ["CONFIRMED", t1, "unpaid"]);
  assert.equal(confirmed.order.items.length, 2, "the answer carries the order's items");

  const shipped = await setOrderStatusIn(db.tx, ORDER_ID, "SHIPPED", t2);
  assert.ok(shipped.ok);
  assert.deepEqual(db.drain(), ["lock order", "update order: fulfillmentStatus, shippedAt, status"]);
  assert.deepEqual([shipped.order.confirmedAt, shipped.order.shippedAt, shipped.order.fulfillmentStatus], [t1, t2, "SHIPPED"]);

  const delivered = await setOrderStatusIn(db.tx, ORDER_ID, "DELIVERED", t3);
  assert.ok(delivered.ok);
  assert.deepEqual(db.drain(), ["lock order", "update order: deliveredAt, fulfillmentStatus, paymentStatus, status"]);
  assert.deepEqual(
    [delivered.order.status, delivered.order.paymentStatus, delivered.order.fulfillmentStatus, delivered.order.deliveredAt, delivered.order.stockHeld],
    ["DELIVERED", "paid", "DELIVERED", t3, true],
  );
  assert.equal(delivered.warning, undefined);
  assert.equal(db.stock(), 10, "the pieces left the stock when the order was placed, and stay out");
});

test("canceling gives the pieces back once, however many times it is asked", async () => {
  const db = fakeDb([order()], [sanadi]);

  const canceled = await setOrderStatusIn(db.tx, ORDER_ID, "CANCELED", t1);
  assert.ok(canceled.ok);
  assert.deepEqual(db.drain(), ["lock order", "stock prod1 +3", "update order: status, stockHeld"]);
  assert.deepEqual([canceled.order.status, canceled.order.stockHeld, db.stock()], ["CANCELED", false, 13]);

  // A double tap, or the app and the dashboard at once: the second request finds the first one's work done
  const again = await setOrderStatusIn(db.tx, ORDER_ID, "CANCELED", t2);
  assert.ok(again.ok);
  assert.deepEqual(db.drain(), ["lock order"], "nothing is written, not even the order's updatedAt");
  assert.equal(db.stock(), 13);

  // Canceled then marked returned: the pieces are already back
  const returned = await setOrderStatusIn(db.tx, ORDER_ID, "RETURNED", t2);
  assert.ok(returned.ok);
  assert.deepEqual(db.drain(), ["lock order", "update order: status"]);
  assert.equal(db.stock(), 13);
});

test("an order brought back takes its pieces again, and says so when the stock ran short", async () => {
  const db = fakeDb([order({ status: "CANCELED", stockHeld: false })], [{ ...sanadi, stock: 13 }]);

  const revived = await setOrderStatusIn(db.tx, ORDER_ID, "CONFIRMED", t1);
  assert.ok(revived.ok);
  assert.deepEqual(db.drain(), ["lock order", "lock product prod1", "stock prod1 -3", "update order: confirmedAt, status, stockHeld"]);
  assert.deepEqual([revived.order.stockHeld, revived.warning, db.stock()], [true, undefined, 10]);

  await setOrderStatusIn(db.tx, ORDER_ID, "RETURNED", t2);
  assert.equal(db.stock(), 13);
  db.setStock(1); // the rest was sold meanwhile
  db.drain();

  const short = await setOrderStatusIn(db.tx, ORDER_ID, "PENDING", t3);
  assert.ok(short.ok, "the change is allowed");
  assert.deepEqual(db.drain(), ["lock order", "lock product prod1", "stock prod1 -1", "update order: status, stockHeld"]);
  assert.deepEqual([short.order.status, short.order.stockHeld, db.stock()], ["PENDING", true, 0]);
  assert.match(short.warning ?? "", /Soutien-gorge: 3 needed, 1 in stock/);

  // With nothing left at all, nothing is taken and the stock stays at zero
  await setOrderStatusIn(db.tx, ORDER_ID, "CANCELED", t3);
  db.setStock(0);
  db.drain();
  const empty = await setOrderStatusIn(db.tx, ORDER_ID, "CONFIRMED", t3);
  assert.ok(empty.ok);
  assert.deepEqual(db.drain(), ["lock order", "lock product prod1", "update order: status, stockHeld"]);
  assert.equal(db.stock(), 0);
  assert.match(empty.warning ?? "", /Soutien-gorge: 3 needed, 0 in stock/);
});

test("lines without a product, and products that no longer exist, hold no stock", async () => {
  const lines = [item({ productId: null }), item({ id: "item2", productId: "gone", quantity: 1 }), item({ id: "item3", productId: "prod1", quantity: 1 })];
  const db = fakeDb([order({ items: lines })], [sanadi]);

  const canceled = await setOrderStatusIn(db.tx, ORDER_ID, "CANCELED", t1);
  assert.ok(canceled.ok);
  assert.deepEqual([db.stock(), canceled.order.stockHeld], [11, false]);

  db.drain();
  const revived = await setOrderStatusIn(db.tx, ORDER_ID, "CONFIRMED", t2);
  assert.ok(revived.ok);
  // Products are locked in one fixed order (by id), whatever the order of the lines
  assert.deepEqual(db.drain(), ["lock order", "lock product gone", "lock product prod1", "stock prod1 -1", "update order: confirmedAt, status, stockHeld"]);
  assert.deepEqual([db.stock(), revived.order.stockHeld, revived.warning], [10, true, undefined]);
});

test("orders of the old store cannot be reached: not cash on delivery, not found", async () => {
  const card = order({ id: "oldcardorder00000000000a", paymentMethod: "card", currency: "USD", stockHeld: false });
  const db = fakeDb([card], [sanadi]);

  assert.deepEqual(await setOrderStatusIn(db.tx, card.id, "CANCELED", t1), { ok: false, error: "Order not found", status: 404 });
  assert.deepEqual(await updateOrderDetailsIn(db.tx, card.id, { adminNote: "x" }), { ok: false, error: "Order not found", status: 404 });
  assert.equal(await deleteOrderIn(db.tx, card.id), false);
  assert.deepEqual(await setOrderStatusIn(db.tx, "nosuchorder", "CONFIRMED", t1), { ok: false, error: "Order not found", status: 404 });

  assert.deepEqual(db.order(card.id), card, "the row is untouched");
  assert.equal(db.stock(), 10);
  assert.ok(db.calls.every((call) => call === "lock order"), "nothing was written");
});

test("deleting an order gives back the pieces it still holds, and only those", async () => {
  const held = fakeDb([order()], [sanadi]);
  assert.equal(await deleteOrderIn(held.tx, ORDER_ID), true);
  assert.deepEqual(held.calls, ["lock order", "stock prod1 +3", "delete order"]);
  assert.deepEqual([held.order(), held.stock()], [undefined, 13]);

  const canceled = fakeDb([order({ status: "CANCELED", stockHeld: false })], [{ ...sanadi, stock: 13 }]);
  assert.equal(await deleteOrderIn(canceled.tx, ORDER_ID), true);
  assert.deepEqual(canceled.calls, ["lock order", "delete order"]);
  assert.deepEqual([canceled.order(), canceled.stock()], [undefined, 13]);

  assert.equal(await deleteOrderIn(canceled.tx, ORDER_ID), false, "already gone");
});

test("an edit writes the fields that changed and nothing when none did", async () => {
  const db = fakeDb([order()], [sanadi]);

  const edited = await updateOrderDetailsIn(db.tx, ORDER_ID, { phone: "0712345678", city: "Rabat", customerName: "Fatima Zahra" });
  assert.ok(edited.ok);
  assert.deepEqual(db.drain(), ["lock order", "update order: city, location, phone, shippingAddress"]);
  assert.deepEqual(
    [edited.order.phone, edited.order.city, edited.order.location, edited.order.shippingAddress],
    ["0712345678", "Rabat", "12 rue Al Massira, Maarif, Rabat", { address1: "12 rue Al Massira, Maarif", city: "Rabat", country: "MA" }],
  );
  assert.equal(edited.order.status, "PENDING", "an edit never touches the status");

  const same = await updateOrderDetailsIn(db.tx, ORDER_ID, { phone: "0712345678", city: "Rabat", address: "12 rue Al Massira, Maarif" });
  assert.ok(same.ok);
  assert.deepEqual(db.drain(), ["lock order"]);

  const noted = await updateOrderDetailsIn(db.tx, ORDER_ID, { adminNote: "call back at 18:00", trackingNumber: "AMZ-123" });
  assert.ok(noted.ok);
  assert.deepEqual(db.drain(), ["lock order", "update order: adminNote, trackingNumber"]);
  const cleared = await updateOrderDetailsIn(db.tx, ORDER_ID, { adminNote: null, trackingNumber: null });
  assert.ok(cleared.ok);
  assert.deepEqual([cleared.order.adminNote, cleared.order.trackingNumber], [null, null]);
});

/* ------------------------------------------------------------------ */
/*  Dashboard figures                                                  */
/* ------------------------------------------------------------------ */

// Sunday 22 November 2026, 13:00 in Morocco (UTC+1)
const dashboardNow = at("2026-11-22T12:00:00Z");
const facts = (o: Partial<CodOrderFacts> & { createdAt: Date }): CodOrderFacts => ({ status: "PENDING", total: 199, confirmedAt: null, deliveredAt: null, ...o });

test("the dashboard counts orders on the day they were placed and deliveries on the day they were delivered, in Morocco time", () => {
  const activity = computeCodActivity(
    [
      facts({ createdAt: at("2026-11-22T09:00:00Z"), total: 350 }),
      // 23:30 UTC on the 21st is already 00:30 on the 22nd in Morocco
      facts({ createdAt: at("2026-11-21T23:30:00Z"), status: "CONFIRMED", confirmedAt: at("2026-11-22T08:00:00Z") }),
      facts({ createdAt: at("2026-11-20T10:00:00Z"), status: "DELIVERED", total: 450, confirmedAt: at("2026-11-20T11:00:00Z"), deliveredAt: at("2026-11-22T10:00:00Z") }),
      facts({ createdAt: at("2026-11-10T10:00:00Z"), status: "RETURNED", total: 350, confirmedAt: at("2026-11-10T11:00:00Z") }),
      facts({ createdAt: at("2026-11-12T10:00:00Z"), status: "CANCELED" }),
      // 23:30 UTC on 31 October is 1 November in Morocco: an order of this month
      facts({ createdAt: at("2026-10-31T23:30:00Z"), status: "DELIVERED", total: 350, confirmedAt: at("2026-11-01T09:00:00Z"), deliveredAt: at("2026-11-03T10:00:00Z") }),
      // Placed in October, delivered in November: this month's cash, not this month's order
      facts({ createdAt: at("2026-10-28T10:00:00Z"), status: "DELIVERED", confirmedAt: at("2026-10-28T11:00:00Z"), deliveredAt: at("2026-11-02T10:00:00Z") }),
      // Confirmed this morning, then the customer stopped answering: no longer a confirmation
      facts({ createdAt: at("2026-11-21T10:00:00Z"), status: "NO_ANSWER", confirmedAt: at("2026-11-22T07:00:00Z") }),
    ],
    dashboardNow,
  );

  assert.deepEqual(activity.today, { orders: 2, value: 549, confirmed: 1, delivered: 1, deliveredRevenue: 450 });
  assert.deepEqual(activity.month, {
    orders: 7,
    value: 2097,
    delivered: 3,
    deliveredRevenue: 999,
    returned: 1,
    canceled: 1,
    confirmationRate: 0.5714, // 4 of this month's 7 orders: confirmed, 2 delivered, returned
    deliveryRate: 0.6667, // of this month's orders: 2 delivered, 1 returned
  });
  assert.deepEqual(activity.days, [
    { date: "2026-11-16", orders: 0, value: 0, delivered: 0, deliveredRevenue: 0 },
    { date: "2026-11-17", orders: 0, value: 0, delivered: 0, deliveredRevenue: 0 },
    { date: "2026-11-18", orders: 0, value: 0, delivered: 0, deliveredRevenue: 0 },
    { date: "2026-11-19", orders: 0, value: 0, delivered: 0, deliveredRevenue: 0 },
    { date: "2026-11-20", orders: 1, value: 450, delivered: 0, deliveredRevenue: 0 },
    { date: "2026-11-21", orders: 1, value: 199, delivered: 0, deliveredRevenue: 0 },
    { date: "2026-11-22", orders: 2, value: 549, delivered: 1, deliveredRevenue: 450 },
  ]);
});

test("a dashboard with no orders is zeros, seven empty days and no rates", () => {
  const empty = computeCodActivity([], dashboardNow);
  assert.deepEqual(empty.today, { orders: 0, value: 0, confirmed: 0, delivered: 0, deliveredRevenue: 0 });
  assert.deepEqual(empty.month, { orders: 0, value: 0, delivered: 0, deliveredRevenue: 0, returned: 0, canceled: 0, confirmationRate: null, deliveryRate: null });
  assert.deepEqual(empty.days.map((d) => d.date), ["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"]);
  assert.ok(empty.days.every((d) => d.orders === 0 && d.value === 0 && d.delivered === 0 && d.deliveredRevenue === 0));

  // Orders, but none has reached an end yet: a confirmation rate, no delivery rate
  const early = computeCodActivity([facts({ createdAt: at("2026-11-22T09:00:00Z") }), facts({ createdAt: at("2026-11-22T09:30:00Z"), status: "SHIPPED", confirmedAt: at("2026-11-22T10:00:00Z") })], dashboardNow);
  assert.equal(early.month.confirmationRate, 0.5);
  assert.equal(early.month.deliveryRate, null);
  assert.equal(early.month.value, 398, "money adds up exactly");
});

test("the older app's keys are the cash collected: a delivered order counts on the day it was delivered", () => {
  const overview = computeSalesOverview(
    [
      { createdAt: at("2026-11-20T10:00:00Z"), deliveredAt: at("2026-11-22T10:00:00Z"), total: 450, status: "DELIVERED" },
      // A delivered order with no delivery time counts on the day it was placed
      { createdAt: at("2026-11-21T10:00:00Z"), deliveredAt: null, total: 199, status: "DELIVERED" },
      { createdAt: at("2026-11-12T09:00:00Z"), deliveredAt: at("2026-11-12T15:00:00Z"), total: 350, status: "DELIVERED" },
      // Not delivered: not a sale yet
      { createdAt: at("2026-11-22T09:00:00Z"), total: 350, status: "PENDING" },
      { createdAt: at("2026-11-21T09:00:00Z"), total: 350, status: "SHIPPED" },
    ],
    dashboardNow,
  );

  assert.deepEqual(Object.keys(overview), ["timeZone", "today", "week", "month"]);
  assert.equal(overview.timeZone, "Africa/Casablanca");
  assert.deepEqual(overview.today, { date: "2026-11-22", revenue: 450, orders: 1 });
  assert.deepEqual(Object.keys(overview.week), ["start", "end", "days", "revenue", "orders", "previousRevenue", "changePercent"]);
  assert.deepEqual([overview.week.start, overview.week.end], ["2026-11-16", "2026-11-22"]);
  assert.deepEqual(
    overview.week.days.map((d) => [d.date, d.label, d.revenue, d.orders]),
    [
      ["2026-11-16", "Mon", 0, 0],
      ["2026-11-17", "Tue", 0, 0],
      ["2026-11-18", "Wed", 0, 0],
      ["2026-11-19", "Thu", 0, 0],
      ["2026-11-20", "Fri", 0, 0],
      ["2026-11-21", "Sat", 199, 1],
      ["2026-11-22", "Sun", 450, 1],
    ],
  );
  assert.deepEqual([overview.week.revenue, overview.week.orders, overview.week.previousRevenue, overview.week.changePercent], [649, 2, 350, 85.4]);
  assert.deepEqual(overview.month, {
    label: "November 2026",
    start: "2026-11-01",
    revenue: 999,
    orders: 3,
    profit: { amount: 0, estimated: false, ordersWithEstimates: 0, productCost: 0, shippingCost: 0, paymentFees: 0, refundCosts: 0 },
  });
});

/* ------------------------------------------------------------------ */
/*  Small pieces of the dashboard                                      */
/* ------------------------------------------------------------------ */

test("links to the orders list carry the status, the search and the page size", () => {
  assert.equal(ordersHref(), "/admin/orders");
  assert.equal(ordersHref({ status: [] }), "/admin/orders");
  assert.equal(ordersHref({ status: ["SHIPPED"] }), "/admin/orders?status=SHIPPED");
  assert.equal(ordersHref({ status: ["PENDING", "NO_ANSWER"] }), "/admin/orders?status=PENDING,NO_ANSWER");
  assert.equal(ordersHref({ status: ["PENDING"], q: "Fatima Zahra & co", show: 200 }), "/admin/orders?status=PENDING&q=Fatima%20Zahra%20%26%20co&show=200");
  // What a link says is what the list reads back
  assert.deepEqual(parseStatusFilter(new URL(ordersHref({ status: ["PENDING", "NO_ANSWER"] }), "http://localhost").searchParams.get("status")), ["PENDING", "NO_ANSWER"]);
});

test("an order's items read as a short line, and a rate as a percentage", () => {
  assert.equal(itemsSummary(order().items), "2 × Soutien-gorge (Noir, XL), 1 × Soutien-gorge (Beige, M)");
  assert.equal(itemsSummary([]), "");
  assert.equal(formatRate(0.6667), "67%");
  assert.equal(formatRate(1), "100%");
  assert.equal(formatRate(0), "0%");
  assert.equal(formatRate(null), "—");
});

test("a redirect from a server action is told apart from a failure", () => {
  assert.equal(isRedirectError(Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/admin/login;303;" })), true);
  assert.equal(isRedirectError(new Error("network")), false);
  assert.equal(isRedirectError(null), false);
  assert.equal(isRedirectError({ digest: 42 }), false);
});
