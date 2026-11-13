import test from "node:test";
import assert from "node:assert/strict";

import {
  buildExpressDetails,
  canShipTo,
  checkExpressDetails,
  detailsFromPayPal,
  detailsFromWallet,
  expressShippingRate,
  normalizePostalCode,
  normalizeUsState,
  paypalAddressReason,
  sameTotal,
  walletConfirmOutcome,
  walletFailureReason,
  type WalletData,
} from "../src/lib/checkout/express-details";
import {
  EXPRESS_APPROVAL_KEY,
  EXPRESS_APPROVAL_TTL_MS,
  forgetExpressApproval,
  expressArrival,
  expressReturnFromUrl,
  parseExpressApproval,
  readExpressAnswer,
  readExpressApproval,
  rememberExpressApproval,
  withoutExpressReturn,
} from "../src/lib/client/paypal-express";
import { CHECKOUT_EVENTS, sanitizeCheckoutEvent } from "../src/lib/checkout/events";
import { SHIPPING_COUNTRY_CODES, type CountryCode } from "../src/config/catalog";
import { parseCartItems, type CartItemPayload, type PriceCartResult, type PricedOrder } from "../src/lib/orders";
import {
  cartFromPayPalItems,
  completeExpressOrder,
  createExpressOrder,
  decodeCartSku,
  encodeCartSku,
  expressCartItems,
  expressOrderBody,
  expressReturnUrls,
  newOrderId,
  paypalApproveUrl,
  paypalAmountCents,
  paypalExpressEnabled,
  type ExpressCompleteDeps,
  type ExpressCreateDeps,
  type ExpressStoreOrder,
} from "../src/lib/payments/paypal-express";
import { EXPRESS_RETURN_PARAM, PAYPAL_EXPRESS_REFERENCE, PAYPAL_ID_RE, STORE_ID_RE } from "../src/lib/payments/paypal-ids";
import { settlePayPalOrder, type PayPalOrder, type SettleDeps, type SettleResult } from "../src/lib/payments/paypal-settle";
import { US_STATES, validateCheckoutDetails, type CheckoutDetails } from "../src/lib/us-address";
import { en } from "../src/messages/en";

/* ---------- US states ---------- */

test("a US state is read from its code or its name, in any case and punctuation", () => {
  for (const { code, name } of US_STATES) {
    assert.equal(normalizeUsState(code), code);
    assert.equal(normalizeUsState(code.toLowerCase()), code);
    assert.equal(normalizeUsState(name), code);
    assert.equal(normalizeUsState(name.toUpperCase()), code);
    assert.equal(normalizeUsState(`  ${name.toLowerCase()}  `), code);
  }
  assert.equal(normalizeUsState("Ca"), "CA");
  assert.equal(normalizeUsState("N.Y."), "NY");
  assert.equal(normalizeUsState("new   york"), "NY");
  assert.equal(normalizeUsState("US-TX"), "TX");
  for (const dc of ["DC", "dc", "D.C.", "d. c.", "District of Columbia", "district of columbia", "Washington DC", "Washington, D.C.", "washington d.c."]) {
    assert.equal(normalizeUsState(dc), "DC", dc);
  }
});

test("territories, military mail and anything that isn't a state are refused", () => {
  for (const bad of ["PR", "Puerto Rico", "GU", "Guam", "VI", "AS", "MP", "AA", "AE", "AP", "", "  ", "XX", "Calif", "Ontario", "12", "C", null, undefined, 42, { state: "CA" }]) {
    assert.equal(normalizeUsState(bad), null, String(bad));
  }
  // The state of Washington is not the capital
  assert.equal(normalizeUsState("Washington"), "WA");
});

/* ---------- postal codes ---------- */

test("a US ZIP becomes 12345 or 12345-6789; other countries keep theirs, trimmed and in capitals", () => {
  assert.equal(normalizePostalCode("US", " 20001 "), "20001");
  assert.equal(normalizePostalCode("US", "200011234"), "20001-1234");
  assert.equal(normalizePostalCode("US", "20001-1234"), "20001-1234");
  assert.equal(normalizePostalCode("US", "20001 1234"), "20001-1234");
  // Not a ZIP: left for the validator to refuse, never "repaired"
  assert.equal(normalizePostalCode("US", "2000"), "2000");
  assert.equal(normalizePostalCode("US", "SW1A 1AA"), "SW1A 1AA");
  assert.equal(normalizePostalCode("US", "A20001"), "A20001");
  assert.equal(normalizePostalCode("GB", " sw1a  1aa "), "SW1A 1AA");
  assert.equal(normalizePostalCode("NL", "1012ab"), "1012AB");
  assert.equal(normalizePostalCode("DE", "10115"), "10115");
  assert.equal(normalizePostalCode("CL", undefined), "");
  assert.equal(normalizePostalCode("US", null), "");
});

/* ---------- wallet → checkout details ---------- */

const wallet = (shipping: Partial<NonNullable<NonNullable<WalletData["shippingAddress"]>["address"]>> = {}, billing: Partial<NonNullable<WalletData["billingDetails"]>> = {}): WalletData => ({
  billingDetails: {
    name: "Card Holder",
    email: "buyer@example.com",
    phone: "+1 (202) 555-0143",
    address: { line1: "1 Billing Rd", line2: null, city: "Billtown", state: "NY", postal_code: "10001", country: "US" },
    ...billing,
  },
  shippingAddress: {
    name: "Test  Customer",
    address: { line1: " 123 Test St ", line2: null, city: "Washington", state: "District of Columbia", postal_code: "200011234", country: "us", ...shipping },
  },
});

test("a wallet's shipping and billing data become the details the form would have produced", () => {
  const details = detailsFromWallet(wallet());
  assert.deepEqual(details, {
    email: "buyer@example.com",
    fullName: "Test Customer",
    phone: "+1 (202) 555-0143",
    address1: "123 Test St",
    address2: "",
    city: "Washington",
    state: "DC",
    zip: "20001-1234",
    country: "US",
    paymentMethod: "card",
  });
  assert.deepEqual(checkExpressDetails(details, ["US"]), { problem: null, errors: {} });
  // The parcel goes to the shipping address, never the card's billing address
  assert.ok(!JSON.stringify(details).includes("Billing"));

  // A second address line is kept; a state given as a code in lower case is read too
  const apartment = detailsFromWallet(wallet({ line2: "Apt 4B", state: "ca", city: "Los Angeles", postal_code: "90001" }));
  assert.equal(apartment.address2, "Apt 4B");
  assert.equal(apartment.state, "CA");
  assert.equal(checkExpressDetails(apartment, ["US"]).problem, null);
});

test("the name falls back to the card holder's when the wallet gave no shipping name", () => {
  const data = wallet();
  data.shippingAddress = { name: "  ", address: data.shippingAddress?.address };
  assert.equal(detailsFromWallet(data).fullName, "Card Holder");
});

test("missing wallet data never passes: no phone, no email, no name, no address", () => {
  const noPhone = detailsFromWallet(wallet({}, { phone: undefined }));
  assert.equal(noPhone.phone, "");
  assert.equal(checkExpressDetails(noPhone, ["US"]).problem, "phone");

  const noEmail = detailsFromWallet(wallet({}, { email: undefined }));
  assert.equal(checkExpressDetails(noEmail, ["US"]).problem, "contact");

  const noName = wallet({}, { name: "" });
  noName.shippingAddress = { name: "", address: noName.shippingAddress?.address };
  assert.equal(checkExpressDetails(detailsFromWallet(noName), ["US"]).problem, "contact");

  assert.equal(checkExpressDetails(detailsFromWallet(wallet({ line1: "" })), ["US"]).problem, "address");
  assert.equal(checkExpressDetails(detailsFromWallet(wallet({ city: null })), ["US"]).problem, "address");
  assert.equal(checkExpressDetails(detailsFromWallet(wallet({ postal_code: "" })), ["US"]).problem, "postal");

  // Nothing at all: every field is empty, the country is unknown, and nothing throws
  for (const empty of [{}, { billingDetails: null, shippingAddress: null }, { shippingAddress: { name: "A B" } }] as WalletData[]) {
    const details = detailsFromWallet(empty);
    assert.equal(details.country, undefined);
    assert.equal(details.address1, "");
    assert.equal(checkExpressDetails(details, ["US"]).problem, "country");
  }
});

test("a US address needs one of the 50 states or DC, and a US phone number", () => {
  for (const state of ["PR", "Puerto Rico", "GU", "AE", "", "Ontario"]) {
    const details = detailsFromWallet(wallet({ state }));
    assert.equal(details.state, "", state);
    const { problem, errors } = checkExpressDetails(details, ["US"]);
    assert.equal(problem, "state", state);
    assert.equal(errors.state, "validation.state");
  }
  // A foreign number on a US address is the phone's problem, not the address's
  const foreignPhone = detailsFromWallet(wallet({}, { phone: "+44 7911 123456" }));
  assert.equal(checkExpressDetails(foreignPhone, ["US"]).problem, "phone");
  for (const phone of ["2025550143", "(202) 555-0143", "+12025550143", "1-202-555-0143"]) {
    assert.equal(checkExpressDetails(detailsFromWallet(wallet({}, { phone })), ["US"]).problem, null, phone);
  }
});

test("each country keeps its own region and postal code rules", () => {
  const all = [...SHIPPING_COUNTRY_CODES];
  const abroad = (country: string, state: string | null, postal_code: string, phone = "+44 7911 123456") =>
    detailsFromWallet(wallet({ country, state, postal_code, city: "Somewhere", line1: "1 High Street" }, { phone }));
  const problem = (details: ReturnType<typeof detailsFromWallet>) => checkExpressDetails(details, all).problem;

  // United Kingdom: the county is optional, the postcode is tidied
  const gb = abroad("GB", "", " sw1a 1aa ");
  assert.equal(gb.country, "GB");
  assert.equal(gb.zip, "SW1A 1AA");
  assert.equal(problem(gb), null);
  assert.equal(abroad("gb", "Greater London", "SW1A1AA").state, "Greater London");
  assert.equal(problem(abroad("GB", null, "12345")), "postal");

  // Germany, France, the Netherlands: region optional
  assert.equal(problem(abroad("DE", "", "10115")), null);
  assert.equal(problem(abroad("DE", "Berlin", "1011")), "postal");
  assert.equal(problem(abroad("FR", null, "75001")), null);
  assert.equal(problem(abroad("FR", "", "7500A")), "postal");
  assert.equal(problem(abroad("NL", "", "1012ab")), null);
  assert.equal(problem(abroad("NL", "", "1012")), "postal");

  // Spain, Mexico, Chile: the region is required, and a wallet often leaves it out
  for (const [country, postal] of [["ES", "28001"], ["MX", "06000"], ["CL", "8320000"]] as const) {
    assert.equal(problem(abroad(country, "", postal)), "state", country);
    assert.equal(problem(abroad(country, "  ", postal)), "state", country);
    const ok = abroad(country, " Madrid ", postal);
    assert.equal(ok.state, "Madrid");
    assert.equal(problem(ok), null, country);
  }
  // Chile delivers without a postal code; Spain and Mexico do not
  assert.equal(problem(abroad("CL", "Región Metropolitana", "")), null);
  assert.equal(problem(abroad("ES", "Madrid", "")), "postal");
  assert.equal(problem(abroad("MX", "CDMX", "0600")), "postal");

  // Outside the US a region is never turned into a US state code
  assert.equal(abroad("DE", "CA", "10115").state, "CA");
  assert.equal(abroad("ES", "california", "28001").state, "california");

  // Phone numbers abroad: 7 to 15 digits
  assert.equal(problem(abroad("GB", "", "SW1A 1AA", "12345")), "phone");
  assert.equal(problem(abroad("GB", "", "SW1A 1AA", "")), "phone");
});

test("an address in a country the store or this cart doesn't ship to is a country problem, never read as a US address", () => {
  for (const country of ["BR", "CA", "AU", "", "USA", "United States", null]) {
    const details = detailsFromWallet(wallet({ country, state: "CA", postal_code: "90001" }));
    assert.equal(details.country, undefined, String(country));
    // Its region and postal code mean nothing in another country's form
    assert.equal(details.state, "");
    assert.equal(details.zip, "");
    assert.deepEqual(checkExpressDetails(details, [...SHIPPING_COUNTRY_CODES]), { problem: "country", errors: { country: "validation.country" } });
    // The trap this guards against: on its own, the form's validator reads a missing country as the United States
    assert.equal(validateCheckoutDetails({ ...details, state: "CA", zip: "90001" }).country, undefined);
  }
  // A country the store ships to, but not this cart (the inflator is US only)
  const gb = detailsFromWallet(wallet({ country: "GB", state: "", postal_code: "SW1A 1AA" }, { phone: "+44 7911 123456" }));
  assert.equal(gb.country, "GB");
  assert.equal(checkExpressDetails(gb, ["US"]).problem, "country");
  assert.equal(checkExpressDetails(gb, ["US", "GB"]).problem, null);
  assert.equal(checkExpressDetails(gb, []).problem, "country");
});

test("problems are reported most serious first, with the phone last", () => {
  const everythingWrong = detailsFromWallet(wallet({ state: "PR", postal_code: "abc", line1: "", city: "" }, { email: "nope", phone: "1" }));
  const { errors } = checkExpressDetails(everythingWrong, ["US"]);
  assert.deepEqual(Object.keys(errors).sort(), ["address1", "city", "email", "phone", "state", "zip"]);
  assert.equal(checkExpressDetails(everythingWrong, ["US"]).problem, "state");
  assert.equal(checkExpressDetails({ ...everythingWrong, state: "NY" }, ["US"]).problem, "postal");
  assert.equal(checkExpressDetails({ ...everythingWrong, state: "NY", zip: "10001" }, ["US"]).problem, "address");
  assert.equal(checkExpressDetails({ ...everythingWrong, state: "NY", zip: "10001", address1: "1 Main St", city: "New York" }, ["US"]).problem, "contact");
  assert.equal(checkExpressDetails({ ...everythingWrong, state: "NY", zip: "10001", address1: "1 Main St", city: "New York", email: "a@b.co" }, ["US"]).problem, "phone");
  assert.equal(checkExpressDetails({ ...everythingWrong, state: "NY", zip: "10001", address1: "1 Main St", city: "New York", email: "a@b.co", phone: "2025550143" }, ["US"]).problem, null);

  assert.equal(walletFailureReason("country"), "address_unserviceable");
  for (const p of ["state", "postal", "address"] as const) assert.equal(walletFailureReason(p), "invalid_shipping_address");
  for (const p of ["contact", "phone"] as const) assert.equal(walletFailureReason(p), "invalid_payment_data");
});

test("the same builder serves another express method, with its own payment method", () => {
  const details = buildExpressDetails(
    { name: "Test Customer", email: "buyer@example.com", phone: "2025550143", line1: "123 Test St", line2: undefined, city: "Washington", region: "DC", postalCode: "20001", country: "US" },
    "paypal",
  );
  assert.equal(details.paymentMethod, "paypal");
  assert.equal(checkExpressDetails(details, ["US"]).problem, null);
  // Values that aren't text are dropped, not stringified
  const odd = buildExpressDetails({ name: 42, email: {}, phone: ["1"], line1: null, city: true, region: 7, postalCode: 20001, country: "US" }, "paypal");
  assert.deepEqual({ ...odd }, { email: "", fullName: "", phone: "", address1: "", address2: "", city: "", state: "", zip: "", country: "US", paymentMethod: "paypal" });
});

/* ---------- while the buyer is still choosing an address ---------- */

test("an express sheet's partial address is accepted only for a country the cart ships to and a real US state", () => {
  const all = [...SHIPPING_COUNTRY_CODES];
  assert.equal(canShipTo({ country: "US", state: "CA" }, ["US"]), true);
  assert.equal(canShipTo({ country: "us", state: "California" }, ["US"]), true);
  // Some wallets hold the state back until the buyer authorises
  assert.equal(canShipTo({ country: "US", state: "" }, ["US"]), true);
  assert.equal(canShipTo({ country: "US" }, ["US"]), true);
  for (const state of ["PR", "Puerto Rico", "GU", "AE", "AP"]) assert.equal(canShipTo({ country: "US", state }, ["US"]), false, state);
  assert.equal(canShipTo({ country: "GB", state: "" }, ["US"]), false);
  assert.equal(canShipTo({ country: "GB", state: "anything" }, all), true);
  for (const country of ["BR", "CA", "", undefined, null, 1]) assert.equal(canShipTo({ country, state: "CA" }, all), false, String(country));
  assert.ok(!(SHIPPING_COUNTRY_CODES as readonly string[]).includes("BR"), "Brazil is never offered");
});

/* ---------- the amount the buyer authorised ---------- */

test("a server total that differs from the amount the buyer authorised in the express sheet is caught", () => {
  assert.equal(sameTotal(59.99, 5999), true);
  assert.equal(sameTotal(99.99, 9999), true);
  assert.equal(sameTotal(1.15, 115), true);
  assert.equal(sameTotal(134.98, 13498), true);
  // Dollars as floats: 0.1 + 0.2 must not come out a cent off
  assert.equal(sameTotal(0.1 + 0.2, 30), true);
  assert.equal(sameTotal(59.99, 6499), false);
  assert.equal(sameTotal(64.99, 5999), false);
  assert.equal(sameTotal(59.98, 5999), false);
  assert.equal(sameTotal(Number.NaN, 5999), false);
  assert.equal(sameTotal(Number.POSITIVE_INFINITY, 5999), false);
});

test("the sheet lists one shipping rate, with the days in transit when the country is known", () => {
  assert.deepEqual(expressShippingRate({ label: "Free tracked shipping", shippingCents: 0 }), { id: "standard", displayName: "Free tracked shipping", amount: 0 });
  assert.deepEqual(expressShippingRate({ label: "Free tracked shipping", shippingCents: 0, days: { min: 4, max: 9 } }), {
    id: "standard",
    displayName: "Free tracked shipping",
    amount: 0,
    deliveryEstimate: { minimum: { unit: "day", value: 4 }, maximum: { unit: "day", value: 9 } },
  });
  assert.equal(expressShippingRate({ label: "Tracked shipping", shippingCents: 499 }).amount, 499);
  assert.equal(expressShippingRate({ label: "x", shippingCents: -1 }).amount, 0);
});

/* ---------- the checkout log and the copy ---------- */

test("express events are on the checkout log's list and carry only a short code", () => {
  for (const name of ["express_shown", "express_clicked", "express_failed"]) {
    assert.ok((CHECKOUT_EVENTS as readonly string[]).includes(name), name);
  }
  assert.deepEqual(sanitizeCheckoutEvent({ e: "express_shown", step: 1, code: "apple_pay,google_pay,paypal", w: 390 }), { e: "express_shown", step: 1, code: "apple_pay,google_pay,paypal", w: 390 });
  assert.deepEqual(sanitizeCheckoutEvent({ e: "express_clicked", step: 1, code: "apple_pay" }), { e: "express_clicked", step: 1, code: "apple_pay" });
  assert.deepEqual(sanitizeCheckoutEvent({ e: "express_failed", ref: "KTV-ZA4OG2CG", step: 1, code: "confirm:card_declined" }), { e: "express_failed", ref: "KTV-ZA4OG2CG", step: 1, code: "confirm:card_declined" });
  // A list of methods is allowed; free text and personal data still are not
  for (const code of ["apple pay", "dan@example.com", "512 Galaxy Ct, Austin", "a".repeat(49), ""]) {
    assert.deepEqual(sanitizeCheckoutEvent({ e: "express_failed", code, name: "Dan", email: "dan@example.com" }), { e: "express_failed" }, code);
  }
});

test("the express block's copy is the agreed wording", () => {
  assert.equal(en.checkout.expressTitle, "Express checkout");
  assert.equal(en.checkout.expressOr, "OR");
  assert.equal(en.checkout.expressWalletDetails, "We couldn't use the address from your wallet. Please check the highlighted details below. You haven't been charged.");
  assert.equal(en.checkout.expressTotalChanged, "Your total changed. Please review your order and try again.");
  assert.equal(en.checkout.expressShippingFree, "Free tracked shipping");
});

/* ---------- the wallet buttons' contract with Stripe ---------- */

test("the wallet buttons confirm the order's one intent, send no address of their own and never mark an order paid", async () => {
  const { readFile } = await import("node:fs/promises");
  const source = await readFile("src/components/checkout/express-checkout.tsx", "utf8");
  // Deferred mode with the cart's amount, and no list of payment method types: the same as the server's intent
  assert.match(source, /mode: "payment", amount: amountCents, currency: "usd"/);
  assert.ok(!source.includes("payment_method_types") && !source.includes("paymentMethodTypes") && !source.includes("PaymentMethodTypes"));
  assert.ok(!source.includes("captureMethod") && !source.includes("setupFutureUsage"));
  // Only wallets in Stripe's row: PayPal has the store's own button
  assert.match(source, /applePay: "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never", klarna: "never"/);
  // The order and its intent come from the routes the form and the card step use
  assert.match(source, /await elements\.submit\(\)/);
  assert.match(source, /fetch\("\/api\/checkout\/stripe"/);
  assert.match(source, /stripe\.confirmPayment\(\{\s+elements,\s+clientSecret: intent\.clientSecret,\s+confirmParams: \{ return_url: returnUrl \},\s+redirect: "if_required",\s+\}\)/);
  // A total the buyer didn't authorise is never confirmed
  assert.ok(source.indexOf("sameTotal(order.totals.total, amountCents)") > 0);
  assert.ok(source.indexOf("sameTotal(order.totals.total, amountCents)") < source.indexOf("stripe.confirmPayment("));
  assert.ok(!source.includes("completePaidOrder"), "the browser never marks an order paid");
  // A click handler has one second to answer: nothing in it may wait
  const click = source.slice(source.indexOf("const handleClick"), source.indexOf("const handleShippingAddressChange"));
  assert.ok(click.includes("event.resolve(") && click.includes("event.reject()") && !click.includes("await"));
});

/* ---------- PayPal → checkout details ---------- */

const STORE_ORDER_ID = "cmw9wrjyz00044ku7za4og2cg";
const PAYPAL_ORDER_ID = "5AB12345CD678901E";

type PayPalUnit = NonNullable<PayPalOrder["purchase_units"]>[number];
type PayPalShippingAddress = NonNullable<NonNullable<PayPalUnit["shipping"]>["address"]>;

/** An express PayPal order as PayPal returns it once the buyer has approved. */
function approvedOrder(
  changes: {
    status?: string;
    value?: string;
    currency?: string;
    referenceId?: string;
    customId?: string;
    address?: Partial<PayPalShippingAddress> | null;
    shippingName?: string | null;
    shippingPhone?: string;
    payer?: PayPalOrder["payer"];
    account?: NonNullable<PayPalOrder["payment_source"]>["paypal"];
    captured?: boolean;
  } = {},
): PayPalOrder {
  const value = changes.value ?? "59.99";
  const amount = { value, currency_code: changes.currency ?? "USD" };
  return {
    id: PAYPAL_ORDER_ID,
    status: changes.status ?? "APPROVED",
    payer: changes.payer ?? {
      name: { given_name: "Pat", surname: "Payer" },
      email_address: "Buyer@Example.com",
      phone: { phone_number: { national_number: "2025550143" } },
    },
    ...(changes.account && { payment_source: { paypal: changes.account } }),
    purchase_units: [
      {
        reference_id: changes.referenceId ?? PAYPAL_EXPRESS_REFERENCE,
        custom_id: changes.customId ?? STORE_ORDER_ID,
        amount,
        shipping: {
          ...(changes.shippingName !== null && { name: { full_name: changes.shippingName ?? "Test  Customer" } }),
          ...(changes.shippingPhone && { phone_number: { national_number: changes.shippingPhone } }),
          ...(changes.address !== null && {
            address: {
              address_line_1: " 123 Test St ",
              admin_area_2: "Washington",
              admin_area_1: "District of Columbia",
              postal_code: "200011234",
              country_code: "US",
              ...changes.address,
            },
          }),
        },
        ...(changes.captured && {
          payments: { captures: [{ id: "CAP123", status: "COMPLETED", amount, seller_receivable_breakdown: { paypal_fee: { value: "2.58", currency_code: "USD" } } }] },
        }),
      },
    ],
  };
}

test("an approved PayPal order's buyer and shipping address become the details the form would have produced", () => {
  const details = detailsFromPayPal(approvedOrder());
  assert.deepEqual(details, {
    email: "Buyer@Example.com",
    fullName: "Test Customer",
    phone: "2025550143",
    address1: "123 Test St",
    address2: "",
    city: "Washington",
    state: "DC",
    zip: "20001-1234",
    country: "US",
    paymentMethod: "paypal",
  });
  assert.deepEqual(checkExpressDetails(details, ["US"]), { problem: null, errors: {} });

  // A second address line is kept; a state arrives as a code or a name, in any case
  const apartment = detailsFromPayPal(approvedOrder({ address: { address_line_2: "Apt 4B", admin_area_1: "ca", admin_area_2: "Los Angeles", postal_code: "90001" } }));
  assert.equal(apartment.address2, "Apt 4B");
  assert.equal(apartment.state, "CA");
  assert.equal(checkExpressDetails(apartment, ["US"]).problem, null);
  for (const { code, name } of US_STATES) {
    assert.equal(detailsFromPayPal(approvedOrder({ address: { admin_area_1: name } })).state, code, name);
    assert.equal(detailsFromPayPal(approvedOrder({ address: { admin_area_1: code.toLowerCase() } })).state, code, code);
  }
});

test("the parcel's name is the shipping name; the PayPal account's name is only the fallback", () => {
  assert.equal(detailsFromPayPal(approvedOrder({ shippingName: "Gift Recipient" })).fullName, "Gift Recipient");
  assert.equal(detailsFromPayPal(approvedOrder({ shippingName: null })).fullName, "Pat Payer");
  assert.equal(detailsFromPayPal(approvedOrder({ shippingName: "   " })).fullName, "Pat Payer");
  // Newer orders repeat the buyer under payment_source.paypal; it is read when the payer block is missing
  const fromAccount = detailsFromPayPal(
    approvedOrder({ shippingName: null, payer: {}, account: { name: { given_name: "Ana", surname: "Account" }, email_address: "ana@example.com", phone_number: { national_number: "2025550199" } } }),
  );
  assert.equal(fromAccount.fullName, "Ana Account");
  assert.equal(fromAccount.email, "ana@example.com");
  assert.equal(fromAccount.phone, "2025550199");
  // A surname alone is still a name; nothing at all is an empty one, for the validator to refuse
  assert.equal(detailsFromPayPal(approvedOrder({ shippingName: null, payer: { name: { surname: "Payer" } } })).fullName, "Payer");
  assert.equal(detailsFromPayPal(approvedOrder({ shippingName: null, payer: {} })).fullName, "");
});

test("the phone is the one the buyer typed for this order, else PayPal's; with neither, the order waits for one", () => {
  const withoutPhone = { name: { given_name: "Pat", surname: "Payer" }, email_address: "buyer@example.com" };
  const none = detailsFromPayPal(approvedOrder({ payer: withoutPhone }));
  assert.equal(none.phone, "");
  assert.equal(checkExpressDetails(none, ["US"]).problem, "phone");

  assert.equal(detailsFromPayPal(approvedOrder({ payer: withoutPhone }), "(202) 555-0143").phone, "(202) 555-0143");
  assert.equal(checkExpressDetails(detailsFromPayPal(approvedOrder({ payer: withoutPhone }), "(202) 555-0143"), ["US"]).problem, null);
  // The shipping contact's number comes before the account's
  assert.equal(detailsFromPayPal(approvedOrder({ shippingPhone: "2025550111" })).phone, "2025550111");
  assert.equal(detailsFromPayPal(approvedOrder()).phone, "2025550143");
  // A number typed for the courier wins over a PayPal one that the address's country rules refuse
  const foreign = approvedOrder({ payer: { ...withoutPhone, phone: { phone_number: { national_number: "7911123456789" } } } });
  assert.equal(checkExpressDetails(detailsFromPayPal(foreign), ["US"]).problem, "phone");
  assert.equal(checkExpressDetails(detailsFromPayPal(foreign, "2025550143"), ["US"]).problem, null);
  // Only text counts as a phone
  for (const junk of [undefined, null, 2025550143, { phone: "2025550143" }, "   "]) {
    assert.equal(detailsFromPayPal(approvedOrder({ payer: withoutPhone }), junk).phone, "");
  }
});

test("PayPal data that is missing or can't be shipped to never passes, and says which part is the problem", () => {
  const problem = (order: PayPalOrder, countries: readonly string[] = ["US"]) => checkExpressDetails(detailsFromPayPal(order), countries).problem;

  assert.equal(problem(approvedOrder({ address: { address_line_1: "" } })), "address");
  assert.equal(problem(approvedOrder({ address: { admin_area_2: undefined } })), "address");
  assert.equal(problem(approvedOrder({ address: { postal_code: "" } })), "postal");
  assert.equal(problem(approvedOrder({ address: { postal_code: "2000" } })), "postal");
  assert.equal(problem(approvedOrder({ payer: { name: { given_name: "Pat" }, phone: { phone_number: { national_number: "2025550143" } } } })), "contact");
  assert.equal(problem(approvedOrder({ shippingName: null, payer: { email_address: "buyer@example.com", phone: { phone_number: { national_number: "2025550143" } } } })), "contact");

  // Territories and military mail are not states the store ships to
  for (const state of ["PR", "Puerto Rico", "GU", "AE", "AP", "", "Ontario"]) {
    const details = detailsFromPayPal(approvedOrder({ address: { admin_area_1: state } }));
    assert.equal(details.state, "", state);
    assert.equal(checkExpressDetails(details, ["US"]).problem, "state", state);
  }

  // A country the store doesn't ship to at all, or not for this cart; never read as a US address
  for (const country of ["BR", "CA", "AU", "", "USA"]) {
    const details = detailsFromPayPal(approvedOrder({ address: { country_code: country } }));
    assert.equal(details.country, undefined, country);
    assert.equal(checkExpressDetails(details, [...SHIPPING_COUNTRY_CODES]).problem, "country", country);
  }
  const gb = approvedOrder({ address: { country_code: "GB", admin_area_1: "", admin_area_2: "London", postal_code: "sw1a 1aa" }, payer: { name: { given_name: "Pat", surname: "Payer" }, email_address: "buyer@example.com", phone: { phone_number: { national_number: "7911123456" } } } });
  assert.equal(problem(gb, ["US"]), "country");
  assert.equal(problem(gb, ["US", "GB"]), null);
  assert.equal(detailsFromPayPal(gb).zip, "SW1A 1AA");

  // No address, or an order with nothing in it: every field is empty and nothing throws
  for (const empty of [{}, { purchase_units: [] }, { purchase_units: [null] }, { payer: null, payment_source: null, purchase_units: null }, approvedOrder({ address: null })]) {
    const details = detailsFromPayPal(empty);
    assert.equal(details.country, undefined);
    assert.equal(details.address1, "");
    assert.equal(checkExpressDetails(details, ["US"]).problem, "country");
  }
});

test("each country keeps its own region and postal code rules for a PayPal address", () => {
  const all = [...SHIPPING_COUNTRY_CODES];
  const abroad = (country: string, region: string | undefined, postal: string | undefined) =>
    detailsFromPayPal(
      approvedOrder({
        address: { country_code: country, admin_area_1: region, admin_area_2: "Somewhere", address_line_1: "1 High Street", postal_code: postal },
        payer: { name: { given_name: "Pat", surname: "Payer" }, email_address: "buyer@example.com", phone: { phone_number: { national_number: "7911123456" } } },
      }),
    );
  const problem = (details: CheckoutDetails) => checkExpressDetails(details, all).problem;

  assert.equal(problem(abroad("GB", undefined, "SW1A 1AA")), null);
  assert.equal(problem(abroad("gb", "Greater London", "12345")), "postal");
  assert.equal(problem(abroad("DE", "", "10115")), null);
  assert.equal(problem(abroad("FR", undefined, "7500A")), "postal");
  assert.equal(problem(abroad("NL", "", "1012ab")), null);
  // Spain, Mexico, Chile need the region, and PayPal often leaves it out
  for (const [country, postal] of [["ES", "28001"], ["MX", "06000"], ["CL", "8320000"]] as const) {
    assert.equal(problem(abroad(country, undefined, postal)), "state", country);
    assert.equal(problem(abroad(country, " Madrid ", postal)), null, country);
  }
  assert.equal(problem(abroad("CL", "Región Metropolitana", undefined)), null, "Chile delivers without a postal code");
  assert.equal(problem(abroad("ES", "Madrid", undefined)), "postal");
  // Outside the US a region is never turned into a US state code
  assert.equal(abroad("DE", "california", "10115").state, "california");
});

test("the buyer is given one of four reasons for an address that can't be used; a name or email problem counts as the address", () => {
  assert.equal(paypalAddressReason("country"), "country");
  assert.equal(paypalAddressReason("state"), "state");
  assert.equal(paypalAddressReason("postal"), "postal");
  assert.equal(paypalAddressReason("address"), "address");
  assert.equal(paypalAddressReason("contact"), "address");
});

/* ---------- PayPal express: ids, amounts and the PayPal order ---------- */

test("an order id chosen before the order exists reads like the database's own", () => {
  const ids = new Set(Array.from({ length: 500 }, () => newOrderId()));
  assert.equal(ids.size, 500);
  for (const id of ids) {
    assert.match(id, /^c[a-z0-9]{24}$/);
    assert.match(id, STORE_ID_RE);
    // Its order reference is one the checkout log accepts
    const ref = `KTV-${id.slice(-8).toUpperCase()}`;
    assert.equal(sanitizeCheckoutEvent({ e: "paypal_approved", ref })?.ref, ref);
  }
  assert.match(STORE_ORDER_ID, STORE_ID_RE);
  assert.match(PAYPAL_ORDER_ID, PAYPAL_ID_RE);
});

test("a PayPal amount is read in cents, and only as US dollars written the way PayPal writes them", () => {
  assert.equal(paypalAmountCents({ value: "59.99", currency_code: "USD" }), 5999);
  assert.equal(paypalAmountCents({ value: "134.98", currency_code: "USD" }), 13498);
  assert.equal(paypalAmountCents({ value: "0.30", currency_code: "USD" }), 30);
  assert.equal(paypalAmountCents({ value: "1.15", currency_code: "USD" }), 115);
  for (const amount of [undefined, null, {}, { value: "59.99" }, { value: "59.99", currency_code: "EUR" }, { value: "59.9", currency_code: "USD" }, { value: "59.990", currency_code: "USD" }, { value: "60", currency_code: "USD" }, { value: "-59.99", currency_code: "USD" }, { value: " 59.99", currency_code: "USD" }, { value: "5e3.00", currency_code: "USD" }]) {
    assert.equal(paypalAmountCents(amount), null, JSON.stringify(amount));
  }
  // What the server asks PayPal for is what it reads back
  for (const total of [59.99, 99.99, 134.98, 0.1 + 0.2]) {
    const cents = paypalAmountCents(expressOrderBody({ orderId: STORE_ORDER_ID, priced: pricedOrder(total), brandName: "Kitvoy" }).purchase_units[0].amount);
    assert.ok(cents !== null && sameTotal(total, cents), String(total));
  }
});

test("the express PayPal order is one capture for the cart's total, for a named store order, with the address chosen in PayPal", () => {
  assert.deepEqual(expressOrderBody({ orderId: STORE_ORDER_ID, priced: pricedOrder(99.99), brandName: "Kitvoy" }), {
    intent: "CAPTURE",
    purchase_units: [
      {
        reference_id: PAYPAL_EXPRESS_REFERENCE,
        custom_id: STORE_ORDER_ID,
        description: "Kitvoy order KTV-ZA4OG2CG",
        amount: { currency_code: "USD", value: "99.99", breakdown: { item_total: { currency_code: "USD", value: "99.99" } } },
        items: [{ name: "1 × PouncePop", sku: "p1||1", quantity: "1", unit_amount: { currency_code: "USD", value: "99.99" }, category: "PHYSICAL_GOODS" }],
      },
    ],
    application_context: { brand_name: "Kitvoy", shipping_preference: "GET_FROM_FILE", user_action: "PAY_NOW" },
  });
  // The marker can never be mistaken for a store order id (which is what a payment-step PayPal order carries there)
  assert.ok(!STORE_ID_RE.test(PAYPAL_EXPRESS_REFERENCE));
});

test("PayPal express is on unless PAYPAL_EXPRESS is off", () => {
  assert.equal(paypalExpressEnabled({}), true);
  assert.equal(paypalExpressEnabled({ PAYPAL_EXPRESS: "" }), true);
  assert.equal(paypalExpressEnabled({ PAYPAL_EXPRESS: "on" }), true);
  assert.equal(paypalExpressEnabled({ PAYPAL_EXPRESS: "off" }), false);
  assert.equal(paypalExpressEnabled({ PAYPAL_EXPRESS: " OFF " }), false);
});

test("cart lines from a request are read in one shape; anything else is dropped", () => {
  const line = { product: { id: "p1", slug: "pouncepop", name: "PouncePop", price: 59.99 }, quantity: 2, variantKey: "blue" };
  const parsed = parseCartItems([line, { ...line, variantKey: undefined, product: { ...line.product, variant: { key: "green" } } }, { ...line, quantity: 1.9, variantKey: "Not A Key" }]);
  assert.deepEqual(parsed.map((i) => [i.product.id, i.quantity, i.variantKey]), [["p1", 2, "blue"], ["p1", 2, "green"], ["p1", 1, undefined]]);
  for (const junk of [undefined, null, "items", {}, [], [null, 1, "x"], [{ ...line, quantity: 0 }], [{ ...line, quantity: "2" }], [{ ...line, product: { ...line.product, id: "" } }], [{ ...line, product: { ...line.product, price: 0 } }], [{ quantity: 1 }]]) {
    assert.deepEqual(parseCartItems(junk), [], JSON.stringify(junk));
  }
});

/* ---------- PayPal express: opening the PayPal order ---------- */

const cart: CartItemPayload[] = parseCartItems([{ product: { id: "p1", slug: "pouncepop", name: "PouncePop", price: 59.99 }, quantity: 1 }]);

const priced = (total: number, allowedCountries: CountryCode[] = ["US"]): PriceCartResult => ({
  ok: true,
  priced: {
    items: [{ productId: "p1", productName: "PouncePop", productSlug: "pouncepop", variantKey: null, unitPrice: total, shippingTax: 0, quantity: 1, lineTotal: total }],
    subtotal: total,
    shippingCost: 0,
    total,
  },
  allowedCountries,
});
/** The PricedOrder of `priced(total)`. */
const pricedOrder = (total: number): PricedOrder => {
  const result = priced(total);
  if (!result.ok) throw new Error("priced() always prices");
  return result.priced;
};

/** Three colours of one product priced as one bundle ($64.99 split into lines of 21.66, 21.66 and 21.67), plus a second product. */
const bundlePriced: PricedOrder = {
  items: [
    { productId: "p1", productName: "PouncePop (Orange)", productSlug: "pouncepop", variantKey: "orange", unitPrice: 29.99, shippingTax: 0, quantity: 1, lineTotal: 21.66 },
    { productId: "p1", productName: "PouncePop (Purple)", productSlug: "pouncepop", variantKey: "purple", unitPrice: 29.99, shippingTax: 0, quantity: 1, lineTotal: 21.66 },
    { productId: "p1", productName: "PouncePop (Blue)", productSlug: "pouncepop", variantKey: "blue", unitPrice: 29.99, shippingTax: 0, quantity: 1, lineTotal: 21.67 },
    { productId: "p2", productName: "Cordless Tire Inflator", productSlug: "cordless-tire-inflator", variantKey: null, unitPrice: 59.99, shippingTax: 0, quantity: 2, lineTotal: 99.99 },
  ],
  subtotal: 164.98,
  shippingCost: 0,
  total: 164.98,
};

const outOfStock: PriceCartResult = { ok: false, failure: { success: false, error: "stock.notEnoughStock", errorKey: "stock.notEnoughStock" } };

function createWorld(
  options: { pricing?: PriceCartResult; sessionOrder?: { id: string; stripePaymentIntentId: string | null } | null; cardInProgress?: boolean; paypalId?: string; links?: unknown } = {},
) {
  const log: string[] = [];
  const deps: ExpressCreateDeps = {
    priceCart: async () => {
      log.push("price");
      return options.pricing ?? priced(59.99);
    },
    sessionOrder: async () => options.sessionOrder ?? null,
    cardPaymentInProgress: async (intent) => {
      log.push(`card:${intent}`);
      return options.cardInProgress ?? false;
    },
    newOrderId: () => {
      log.push("newId");
      return `c${"a".repeat(24)}`;
    },
    openPayPalOrder: async ({ orderId, priced: cartPriced, redirect }) => {
      log.push(`open:${orderId}:${cartPriced.total}${redirect ? ":redirect" : ""}`);
      return { id: options.paypalId ?? PAYPAL_ORDER_ID, links: options.links };
    },
  };
  return { deps, log };
}

test("opening an express PayPal order prices the cart on the server and names a new order id", async () => {
  const { deps, log } = createWorld({ pricing: priced(99.99, ["US", "GB"]) });
  assert.deepEqual(await createExpressOrder(cart, deps), { ok: true, paypalOrderId: PAYPAL_ORDER_ID, allowedCountries: ["US", "GB"] });
  assert.deepEqual(log, ["price", "newId", `open:c${"a".repeat(24)}:99.99`]);
});

test("a checkout that already has an open order keeps it: the PayPal order is opened for that order's id", async () => {
  const { deps, log } = createWorld({ sessionOrder: { id: STORE_ORDER_ID, stripePaymentIntentId: "pi_1" } });
  assert.equal((await createExpressOrder(cart, deps)).ok, true);
  assert.deepEqual(log, ["price", "card:pi_1", `open:${STORE_ORDER_ID}:59.99`], "one order per checkout: no new id");

  // ...unless a card payment for it is already settling: no second way to pay is opened
  const settling = createWorld({ sessionOrder: { id: STORE_ORDER_ID, stripePaymentIntentId: "pi_1" }, cardInProgress: true });
  assert.deepEqual(await createExpressOrder(cart, settling.deps), { ok: false, error: "checkout.paymentInProgress", status: 409 });
  assert.equal(settling.log.some((l) => l.startsWith("open:")), false);
});

test("no PayPal order is opened for a cart that can't be bought", async () => {
  const empty = createWorld();
  assert.deepEqual(await createExpressOrder([], empty.deps), { ok: false, error: "EMPTY_CART", status: 400 });
  assert.deepEqual(empty.log, []);

  const cases: [PriceCartResult, string][] = [
    [outOfStock, "stock.notEnoughStock"],
    [{ ok: false, failure: { success: false, error: "Product not found" } }, "Product not found"],
    [priced(0), "order.errorGeneric"],
    [priced(59.99, []), "order.errorCountryUnavailable"],
  ];
  for (const [pricing, error] of cases) {
    const { deps, log } = createWorld({ pricing });
    assert.deepEqual(await createExpressOrder(cart, deps), { ok: false, error, status: 400 });
    assert.deepEqual(log, ["price"], error);
  }

  // An answer from PayPal that isn't an order id is never handed to the browser
  const odd = createWorld({ paypalId: "" });
  assert.deepEqual(await createExpressOrder(cart, odd.deps), { ok: false, error: "PAYMENT_INIT_FAILED", status: 502 });
});

/* ---------- PayPal express: the cart written into the PayPal order ---------- */

test("a cart line round-trips through a PayPal item's sku, and nothing else decodes", () => {
  for (const line of [
    { productId: "cmwdybx4e000214dqnneta1rk", variantKey: "blue", quantity: 3 },
    { productId: "p1", variantKey: null, quantity: 1 },
    { productId: "kitvoy-local-preview", variantKey: null, quantity: 9999 },
  ]) {
    assert.deepEqual(decodeCartSku(encodeCartSku(line)), line);
  }
  for (const junk of [undefined, null, 7, "", "p1", "p1|blue", "p1|blue|2|x", "|blue|2", "p1|Blue|2", "p1|blue|0", "p1|blue|01", "p1|blue|10000", "p1|blue|1.5", "p1|blue|-1", "p 1||1", "p1|<b>|1", `${"x".repeat(130)}||1`]) {
    assert.equal(decodeCartSku(junk), null, String(junk));
  }
});

test("the cart is listed in the PayPal order with a breakdown that adds up to the cent", () => {
  const items = expressCartItems(bundlePriced);
  assert.ok(items);
  assert.equal(items.length, 4);
  // Quantity 1 and the line's own total: a bundle's price doesn't divide evenly by its quantity
  assert.deepEqual(items.map((i) => [i.quantity, i.unit_amount.value, i.sku]), [
    ["1", "21.66", "p1|orange|1"],
    ["1", "21.66", "p1|purple|1"],
    ["1", "21.67", "p1|blue|1"],
    ["1", "99.99", "p2||2"],
  ]);
  assert.equal(items[3].name, "2 × Cordless Tire Inflator");

  const unit = expressOrderBody({ orderId: STORE_ORDER_ID, priced: bundlePriced, brandName: "Kitvoy" }).purchase_units[0];
  const itemCents = (unit.items ?? []).reduce((sum, i) => sum + (paypalAmountCents(i.unit_amount) ?? NaN), 0);
  assert.equal(itemCents, 16498);
  assert.equal(paypalAmountCents(unit.amount), 16498);
  assert.equal(paypalAmountCents(unit.amount.breakdown?.item_total), 16498);
  assert.equal("shipping" in (unit.amount.breakdown ?? {}), false, "free shipping lists no shipping line");

  // A shipping charge goes in the breakdown, so items plus shipping are the total
  const withShipping = { ...bundlePriced, shippingCost: 4.5, total: 169.48 };
  const shipped = expressOrderBody({ orderId: STORE_ORDER_ID, priced: withShipping, brandName: "Kitvoy" }).purchase_units[0];
  assert.deepEqual(shipped.amount.breakdown, { item_total: { currency_code: "USD", value: "164.98" }, shipping: { currency_code: "USD", value: "4.50" } });
  assert.equal(shipped.amount.value, "169.48");

  // A line that can't be written as a sku that reads back as itself: nothing is listed, and the amount stays
  const odd = { ...bundlePriced, items: [{ ...bundlePriced.items[0], productId: "p|1" }] };
  assert.equal(expressCartItems(odd), null);
  const unlisted = expressOrderBody({ orderId: STORE_ORDER_ID, priced: { ...odd, total: 21.66 }, brandName: "Kitvoy" }).purchase_units[0];
  assert.equal("items" in unlisted, false);
  assert.equal("breakdown" in unlisted.amount, false);
  assert.equal(unlisted.amount.value, "21.66");
});

test("the cart is read back from the PayPal order's items, and an order listing items the store didn't write is refused", () => {
  const items = expressCartItems(bundlePriced)!;
  const back = cartFromPayPalItems(items);
  assert.ok(back.ok && back.items);
  assert.deepEqual(back.items.map((i) => [i.product.id, i.variantKey, i.quantity]), [
    ["p1", "orange", 1],
    ["p1", "purple", 1],
    ["p1", "blue", 1],
    ["p2", undefined, 2],
  ]);
  // No items at all: nothing to read, and the browser's cart is priced instead
  assert.deepEqual(cartFromPayPalItems(undefined), { ok: true, items: null });
  assert.deepEqual(cartFromPayPalItems(null), { ok: true, items: null });
  assert.deepEqual(cartFromPayPalItems([]), { ok: true, items: null });
  // Tampered, repeated or too many lines: refused, never guessed at
  assert.deepEqual(cartFromPayPalItems([{ ...items[0], sku: "p1|orange|1|extra" }]), { ok: false });
  assert.deepEqual(cartFromPayPalItems([{ ...items[0], sku: undefined }]), { ok: false });
  assert.deepEqual(cartFromPayPalItems([items[0], items[0]]), { ok: false });
  assert.deepEqual(cartFromPayPalItems(Array.from({ length: 51 }, (_, i) => ({ ...items[0], sku: `p${i}||1` }))), { ok: false });
});

test("a redirect payment comes back to the checkout on the store's own origin, with no token in the address", () => {
  assert.deepEqual(expressReturnUrls("https://kitvoy.com"), {
    returnUrl: `https://kitvoy.com/checkout?${EXPRESS_RETURN_PARAM}=return`,
    cancelUrl: `https://kitvoy.com/checkout?${EXPRESS_RETURN_PARAM}=cancel`,
  });
  assert.equal(expressReturnUrls("https://kitvoy.com/").returnUrl, `https://kitvoy.com/checkout?${EXPRESS_RETURN_PARAM}=return`);
  const redirect = expressOrderBody({ orderId: STORE_ORDER_ID, priced: pricedOrder(29.99), brandName: "Kitvoy", redirect: expressReturnUrls("https://kitvoy.com") });
  assert.equal(redirect.application_context.return_url, `https://kitvoy.com/checkout?${EXPRESS_RETURN_PARAM}=return`);
  assert.equal(redirect.application_context.cancel_url, `https://kitvoy.com/checkout?${EXPRESS_RETURN_PARAM}=cancel`);
  assert.equal("return_url" in expressOrderBody({ orderId: STORE_ORDER_ID, priced: pricedOrder(29.99), brandName: "Kitvoy" }).application_context, false);
});

test("the approval page is only ever one on paypal.com", () => {
  assert.equal(paypalApproveUrl([{ rel: "self", href: "https://api.paypal.com/v2/x" }, { rel: "approve", href: "https://www.paypal.com/checkoutnow?token=5O190127TN364715T" }]), "https://www.paypal.com/checkoutnow?token=5O190127TN364715T");
  assert.equal(paypalApproveUrl([{ rel: "payer-action", href: "https://www.sandbox.paypal.com/checkoutnow?token=X" }]), "https://www.sandbox.paypal.com/checkoutnow?token=X");
  for (const links of [undefined, null, "x", [], [{ rel: "self", href: "https://www.paypal.com/x" }], [{ rel: "approve", href: "https://evil.example/paypal.com/" }], [{ rel: "approve", href: "https://paypal.com.evil.example/" }], [{ rel: "approve", href: "http://www.paypal.com/x" }], [{ rel: "approve", href: 42 }]]) {
    assert.equal(paypalApproveUrl(links), null, JSON.stringify(links));
  }
});

test("opening an express PayPal order for a redirect hands back PayPal's approval page", async () => {
  const approve = "https://www.paypal.com/checkoutnow?token=5O190127TN364715T";
  const { deps, log } = createWorld({ links: [{ rel: "approve", href: approve }] });
  assert.deepEqual(await createExpressOrder(cart, deps, { redirect: true }), { ok: true, paypalOrderId: PAYPAL_ORDER_ID, allowedCountries: ["US"], approveUrl: approve });
  assert.deepEqual(log, ["price", "newId", `open:c${"a".repeat(24)}:59.99:redirect`]);
  // No approval page from PayPal: nothing to send the buyer to
  const none = createWorld({ links: [{ rel: "self", href: "https://api.paypal.com/v2/x" }] });
  assert.deepEqual(await createExpressOrder(cart, none.deps, { redirect: true }), { ok: false, error: "PAYMENT_INIT_FAILED", status: 502 });
});

test("PayPal's return to the checkout is read only for an express payment, and only completed for the order this browser opened", () => {
  const marker = { id: PAYPAL_ORDER_ID, at: 1, cart: "p1x1" };
  const back = (query: string) => expressReturnFromUrl(`https://kitvoy.com/checkout?${query}`);
  assert.deepEqual(back(`ppx=return&token=${PAYPAL_ORDER_ID}&PayerID=ABC`), { kind: "return", token: PAYPAL_ORDER_ID });
  assert.deepEqual(back(`ppx=cancel&token=${PAYPAL_ORDER_ID}`), { kind: "cancel", token: PAYPAL_ORDER_ID });
  assert.deepEqual(back("ppx=return&token=not-an-id"), { kind: "return", token: null });
  // The payment step's own return, and anything else, is not an express return
  for (const query of [`pp=return&token=${PAYPAL_ORDER_ID}`, `ppx=return&pp=return&token=${PAYPAL_ORDER_ID}`, "ppx=other", "r=abc", ""]) assert.equal(back(query), null, query);

  assert.deepEqual(expressArrival(back(`ppx=return&token=${PAYPAL_ORDER_ID}`), marker), { kind: "return", id: PAYPAL_ORDER_ID });
  assert.deepEqual(expressArrival(back("ppx=return&token=9XY98765ZW432109K"), marker), { kind: "unknown", code: "mismatch" });
  assert.deepEqual(expressArrival(back(`ppx=return&token=${PAYPAL_ORDER_ID}`), null), { kind: "unknown", code: "no_marker" });
  assert.deepEqual(expressArrival(back(`ppx=cancel&token=${PAYPAL_ORDER_ID}`), marker), { kind: "cancel" });
  assert.deepEqual(expressArrival(back(`ppx=cancel&token=${PAYPAL_ORDER_ID}`), null), { kind: "cancel" });
  assert.deepEqual(expressArrival(back("ppx=cancel&token=9XY98765ZW432109K"), marker), { kind: "unknown", code: "mismatch" });
  assert.equal(expressArrival(null, marker), null);

  // PayPal's parameters leave the address bar; the payment step's return is left to its own code
  assert.equal(withoutExpressReturn(`https://kitvoy.com/checkout?ppx=return&token=${PAYPAL_ORDER_ID}&PayerID=ABC`), "/checkout");
  assert.equal(withoutExpressReturn("https://kitvoy.com/checkout?ppx=cancel&token=X&utm_source=ig"), "/checkout?utm_source=ig");
  assert.equal(withoutExpressReturn(`https://kitvoy.com/checkout?pp=return&token=${PAYPAL_ORDER_ID}`), `/checkout?pp=return&token=${PAYPAL_ORDER_ID}`);
});

test("completing reads the cart from the PayPal order, not from the browser", async () => {
  const listed = expressCartItems(pricedOrder(59.99))!;
  const priceCalls: string[][] = [];
  const order = approvedOrder({});
  const unit = order.purchase_units![0]!;
  const remote: PayPalOrder = { ...order, purchase_units: [{ ...unit, items: listed }] };
  const deps: ExpressCompleteDeps = {
    getPayPalOrder: async () => remote,
    findOrder: async () => null,
    priceCart: async (items) => {
      priceCalls.push(items.map((i) => `${i.product.id}x${i.quantity}`));
      return priced(59.99);
    },
    saveOrder: async ({ orderId }) => ({ ok: true, order: openStoreOrder({ id: orderId, paymentRef: PAYPAL_ORDER_ID }) }),
    cardPaymentInProgress: async () => false,
    settle: async () => ({ status: "paid" }) as SettleResult,
    forget: async () => {},
    contents: async () => [],
  };
  // The browser sends another cart (or none): the PayPal order's one is priced
  const otherCart = parseCartItems([{ product: { id: "p9", slug: "x", name: "X", price: 1 }, quantity: 5 }]);
  assert.equal((await completeExpressOrder({ paypalOrderId: PAYPAL_ORDER_ID, items: otherCart }, deps)).status, "paid");
  assert.equal((await completeExpressOrder({ paypalOrderId: PAYPAL_ORDER_ID, items: [] }, deps)).status, "paid");
  assert.deepEqual(priceCalls, [["p1x1"], ["p1x1"]]);

  // Items the store didn't write: refused before anything is priced or saved
  const tampered: PayPalOrder = { ...order, purchase_units: [{ ...unit, items: [{ ...listed[0], sku: "p1||7|x" }] }] };
  const refused = await completeExpressOrder({ paypalOrderId: PAYPAL_ORDER_ID, items: cart }, { ...deps, getPayPalOrder: async () => tampered });
  assert.deepEqual(refused, { status: "not_completed", code: "cart_record" });
  assert.equal(priceCalls.length, 2);
});

/* ---------- PayPal express: completing an approved payment ---------- */

const openStoreOrder = (changes: Partial<ExpressStoreOrder> = {}): ExpressStoreOrder => ({
  id: STORE_ORDER_ID,
  total: 59.99,
  status: "PENDING",
  paymentStatus: "unpaid",
  paymentRef: null,
  stripePaymentIntentId: null,
  ...changes,
});

/** An error as the PayPal SDK throws it: the HTTP status it got, when it got an answer at all. */
const paypalError = (message: string, statusCode?: number) => Object.assign(new Error(message), statusCode === undefined ? {} : { statusCode });

/**
 * The outside world of completing an express payment, recorded.
 * `settleThrows` is the error the capture ends in (true: PayPal refusing the
 * funding source with a 422); `afterFailedCapture` is what PayPal shows when
 * asked again after it.
 */
function completeWorld(
  remote: PayPalOrder | null,
  options: {
    order?: ExpressStoreOrder | null;
    pricing?: PriceCartResult;
    settled?: SettleResult;
    settleThrows?: boolean | Error;
    afterFailedCapture?: PayPalOrder | null;
    saveError?: string;
    cardInProgress?: boolean;
  } = {},
) {
  const state: { remote: PayPalOrder | null; order: ExpressStoreOrder | null } = { remote, order: options.order ?? null };
  const log: string[] = [];
  const saved: CheckoutDetails[] = [];
  const deps: ExpressCompleteDeps = {
    cardPaymentInProgress: async (intent) => {
      if (intent) log.push(`card:${intent}`);
      return options.cardInProgress ?? false;
    },
    forget: async (orderId, paypalOrderId) => {
      log.push(`forget:${orderId}:${paypalOrderId}`);
      if (state.order?.id === orderId && state.order.paymentRef === paypalOrderId) state.order = { ...state.order, paymentRef: null };
    },
    getPayPalOrder: async () => {
      log.push("get");
      return state.remote;
    },
    findOrder: async (orderId) => {
      log.push(`find:${orderId}`);
      return state.order;
    },
    priceCart: async () => {
      log.push("price");
      return options.pricing ?? priced(59.99);
    },
    saveOrder: async ({ orderId, paypalOrderId, details }) => {
      log.push(`save:${orderId}`);
      saved.push(details);
      if (options.saveError) return { ok: false, error: options.saveError };
      state.order = openStoreOrder({ id: orderId, paymentRef: paypalOrderId });
      return { ok: true, order: state.order };
    },
    settle: async (order, paypalOrderId) => {
      log.push(`settle:${order.id}:${paypalOrderId}`);
      if (options.settleThrows) {
        if (options.afterFailedCapture !== undefined) state.remote = options.afterFailedCapture;
        throw options.settleThrows === true ? paypalError("INSTRUMENT_DECLINED", 422) : options.settleThrows;
      }
      return options.settled ?? { status: "paid" };
    },
    contents: async () => [{ id: "KV-POUNCE", quantity: 1, item_price: 59.99 }],
  };
  const complete = (input: { paypalOrderId?: unknown; phone?: unknown; items?: CartItemPayload[] } = {}) =>
    completeExpressOrder({ paypalOrderId: "paypalOrderId" in input ? input.paypalOrderId : PAYPAL_ORDER_ID, items: input.items ?? cart, phone: input.phone }, deps);
  return { deps, log, saved, state, complete };
}

const withoutPhone = { name: { given_name: "Pat", surname: "Payer" }, email_address: "buyer@example.com" };
const took = (log: string[], step: string) => log.some((l) => l.startsWith(step));
const FORGOT = `forget:${STORE_ORDER_ID}:${PAYPAL_ORDER_ID}`;

test("an approved express payment is checked, saved as the named order, then settled: in that order", async () => {
  const world = completeWorld(approvedOrder());
  assert.deepEqual(await world.complete(), {
    status: "paid",
    orderReference: "KTV-ZA4OG2CG",
    total: 59.99,
    contents: [{ id: "KV-POUNCE", quantity: 1, item_price: 59.99 }],
  });
  assert.deepEqual(world.log, ["get", `find:${STORE_ORDER_ID}`, "price", `save:${STORE_ORDER_ID}`, `settle:${STORE_ORDER_ID}:${PAYPAL_ORDER_ID}`]);
  // The order is saved with PayPal's address, not anything the browser sent
  assert.deepEqual(world.saved, [detailsFromPayPal(approvedOrder())]);
  assert.equal(world.saved[0].paymentMethod, "paypal");
});

test("an address that can't be shipped to ends the payment before anything is saved or captured", async () => {
  const cases: [PayPalOrder, string][] = [
    [approvedOrder({ address: { country_code: "BR" } }), "country"],
    [approvedOrder({ address: { country_code: "GB", postal_code: "SW1A 1AA", admin_area_1: "" } }), "country"],
    [approvedOrder({ address: { admin_area_1: "PR" } }), "state"],
    [approvedOrder({ address: { postal_code: "abc" } }), "postal"],
    [approvedOrder({ address: { address_line_1: "" } }), "address"],
    [approvedOrder({ address: null }), "country"],
    // No email from PayPal: the buyer is sent to the form, as for an address
    [approvedOrder({ payer: { name: { given_name: "Pat", surname: "Payer" }, phone: { phone_number: { national_number: "2025550143" } } } }), "address"],
  ];
  for (const [remote, reason] of cases) {
    const world = completeWorld(remote);
    assert.deepEqual(await world.complete(), { status: "address_unusable", reason }, reason);
    assert.equal(took(world.log, "save") || took(world.log, "settle"), false, reason);
  }
});

test("the checks run address first, then phone, then price", async () => {
  const noPhone = { payer: withoutPhone };
  // Bad address and no phone: the address is the answer (a phone wouldn't help)
  assert.deepEqual(await completeWorld(approvedOrder({ ...noPhone, address: { admin_area_1: "Guam" } })).complete(), { status: "address_unusable", reason: "state" });
  // Bad address and a changed price: still the address
  assert.deepEqual(await completeWorld(approvedOrder({ address: { country_code: "BR" } }), { pricing: priced(64.99) }).complete(), { status: "address_unusable", reason: "country" });
  // No phone and a changed price: the phone is asked for first
  assert.deepEqual(await completeWorld(approvedOrder(noPhone), { pricing: priced(64.99) }).complete(), { status: "needs_phone" });
  // With the phone given, the changed price is what stops it
  assert.deepEqual(await completeWorld(approvedOrder(noPhone), { pricing: priced(64.99) }).complete({ phone: "2025550143" }), { status: "price_changed" });
});

test("without a phone number the order waits for one; the same call with a phone finishes it", async () => {
  const world = completeWorld(approvedOrder({ payer: withoutPhone }));
  // Exactly this and nothing else: the answer carries nothing about the buyer
  assert.deepEqual(await world.complete(), { status: "needs_phone" });
  assert.deepEqual(world.log, ["get", `find:${STORE_ORDER_ID}`, "price"], "nothing saved, nothing captured");

  // A number the country's rules refuse is asked for again
  assert.deepEqual(await world.complete({ phone: "12345" }), { status: "needs_phone" });
  assert.equal(took(world.log, "save"), false);

  const done = await world.complete({ phone: "(202) 555-0143" });
  assert.equal(done.status, "paid");
  assert.equal(world.saved.length, 1);
  assert.equal(world.saved[0].phone, "(202) 555-0143");
  assert.equal(world.log.filter((l) => l.startsWith("settle")).length, 1);
});

test("a cart that costs something else than the buyer approved is never captured", async () => {
  for (const [approved, now] of [["59.99", 64.99], ["64.99", 59.99], ["59.99", 59.98], ["99.99", 134.98]] as const) {
    const world = completeWorld(approvedOrder({ value: approved }), { pricing: priced(now) });
    assert.deepEqual(await world.complete(), { status: "price_changed" }, `${approved} → ${now}`);
    assert.equal(took(world.log, "save") || took(world.log, "settle"), false);
  }
  // The same total goes through, however the float came out
  assert.equal((await completeWorld(approvedOrder({ value: "0.30" }), { pricing: priced(0.1 + 0.2) }).complete()).status, "paid");
});

test("only an approved PayPal order that the express button opened for a store order is completed", async () => {
  const refused: [PayPalOrder | null, string, unknown?][] = [
    [null, "gone"],
    // A PayPal order of the payment step carries the store order's id as its reference: not this route's
    [approvedOrder({ referenceId: STORE_ORDER_ID }), "not_express"],
    [approvedOrder({ referenceId: "" }), "not_express"],
    [{ id: PAYPAL_ORDER_ID, status: "APPROVED" }, "not_express"],
    [approvedOrder({ customId: "'; drop table orders;--" }), "no_order_id"],
    [approvedOrder({ customId: "" }), "no_order_id"],
    [approvedOrder({ status: "CREATED" }), "not_approved"],
    [approvedOrder({ status: "PAYER_ACTION_REQUIRED" }), "not_approved"],
    [approvedOrder({ status: "VOIDED" }), "not_approved"],
    [approvedOrder({ currency: "EUR" }), "amount"],
    [approvedOrder({ value: "59.9" }), "amount"],
  ];
  for (const [remote, code] of refused) {
    const world = completeWorld(remote);
    assert.deepEqual(await world.complete(), { status: "not_completed", code }, code);
    assert.equal(took(world.log, "price") || took(world.log, "save") || took(world.log, "settle"), false, code);
  }

  // An id that isn't a PayPal order id is never sent to PayPal
  for (const id of [undefined, null, "", 42, "5ab12345cd678901e", "../../etc/passwd", { id: PAYPAL_ORDER_ID }]) {
    const world = completeWorld(approvedOrder());
    assert.deepEqual(await world.complete({ paypalOrderId: id }), { status: "not_completed", code: "invalid_id" });
    assert.deepEqual(world.log, []);
  }

  // A cart that is empty or can't be priced
  const empty = completeWorld(approvedOrder());
  assert.deepEqual(await empty.complete({ items: [] }), { status: "not_completed", code: "empty_cart" });
  const sold = completeWorld(approvedOrder(), { pricing: outOfStock });
  assert.deepEqual(await sold.complete(), { status: "not_completed", code: "cart" });
  assert.equal(took(sold.log, "save"), false);
});

test("completing is safe to repeat: an order that is already paid answers paid again and touches nothing", async () => {
  for (const remote of [approvedOrder(), approvedOrder({ status: "COMPLETED", captured: true })]) {
    const world = completeWorld(remote, { order: openStoreOrder({ paymentStatus: "paid", status: "CONFIRMED", paymentRef: "CAP123" }) });
    assert.deepEqual(await world.complete(), { status: "paid", orderReference: "KTV-ZA4OG2CG", total: 59.99, contents: [{ id: "KV-POUNCE", quantity: 1, item_price: 59.99 }] });
    assert.deepEqual(world.log, ["get", `find:${STORE_ORDER_ID}`]);
  }
  // A canceled order is not brought back
  const canceled = completeWorld(approvedOrder(), { order: openStoreOrder({ status: "CANCELED" }) });
  assert.deepEqual(await canceled.complete(), { status: "not_completed", code: "order_closed" });
  assert.equal(took(canceled.log, "save"), false);
});

test("a payment PayPal captured but the store never recorded is recorded without saving or capturing anything new", async () => {
  const captured = approvedOrder({ status: "COMPLETED", captured: true });
  const world = completeWorld(captured, { order: openStoreOrder({ paymentRef: PAYPAL_ORDER_ID }) });
  assert.equal((await world.complete()).status, "paid");
  assert.deepEqual(world.log, ["get", `find:${STORE_ORDER_ID}`, `settle:${STORE_ORDER_ID}:${PAYPAL_ORDER_ID}`]);

  // Captured, but for no open order the store holds under this PayPal order: nothing is created from here.
  // PayPal has the money all the same, so the buyer is not told they weren't charged
  for (const order of [null, openStoreOrder(), openStoreOrder({ paymentRef: "OTHERPAYPALORDER1" })]) {
    const lost = completeWorld(captured, { order });
    assert.deepEqual(await lost.complete(), { status: "unconfirmed", code: "completed_unknown" });
    assert.equal(took(lost.log, "save") || took(lost.log, "settle") || took(lost.log, "forget"), false);
  }
  const closed = completeWorld(captured, { order: openStoreOrder({ status: "CANCELED", paymentRef: PAYPAL_ORDER_ID }) });
  assert.deepEqual(await closed.complete(), { status: "unconfirmed", code: "order_closed" });
  assert.equal(took(closed.log, "settle"), false);
});

test("an order that couldn't be saved is never captured", async () => {
  const unsaved = completeWorld(approvedOrder(), { saveError: "stock.notEnoughStock" });
  assert.deepEqual(await unsaved.complete(), { status: "not_completed", code: "save" });
  assert.equal(took(unsaved.log, "settle"), false);
});

test("the buyer is told they weren't charged only when PayPal took nothing, and the order then stops naming the PayPal order", async () => {
  // PayPal refused the capture (a declined funding source) and still shows the order as approved, not captured
  const declined = completeWorld(approvedOrder(), { settleThrows: true });
  assert.deepEqual(await declined.complete(), { status: "not_completed", code: "capture_failed" });
  assert.equal(declined.log.at(-1), FORGOT, "no notification and no reload can capture it later");
  assert.equal(declined.state.order?.paymentRef, null);

  // Settling says nothing was captured: the same
  for (const reason of ["capture_declined", "not_approved", "gone", "mismatch", "awaiting_details", "no_paypal_order"] as const) {
    const world = completeWorld(approvedOrder(), { settled: { status: "open", reason } });
    assert.deepEqual(await world.complete(), { status: "not_completed", code: `settle_${reason}` }, reason);
    assert.equal(world.log.at(-1), FORGOT, reason);
  }

  // A refusal that leaves PayPal showing the money taken after all, or PayPal not answering when asked: the error stands
  for (const after of [approvedOrder({ status: "COMPLETED", captured: true }), null]) {
    const unknown = completeWorld(approvedOrder(), { settleThrows: true, afterFailedCapture: after });
    await assert.rejects(unknown.complete(), /INSTRUMENT_DECLINED/);
    assert.equal(took(unknown.log, "forget"), false, "the order keeps naming the PayPal order, so a capture that did go through is still recorded");
  }
});

test("a capture that failed without a refusal from PayPal is never called 'not charged', even while PayPal still shows the order approved", async () => {
  // A timeout or a dropped connection has no status; a 5xx is PayPal failing, not refusing. The capture may be
  // completing at PayPal all the while, so nothing is claimed and the order keeps naming the PayPal order
  // A 409, or the same capture still running for another request, is not a refusal either: that other request may be taking the money
  for (const error of [paypalError("ETIMEDOUT"), paypalError("socket hang up"), paypalError("INTERNAL_SERVER_ERROR", 500), paypalError("SERVICE_UNAVAILABLE", 503), paypalError("CONFLICT", 409), paypalError("PREVIOUS_REQUEST_IN_PROGRESS", 422)]) {
    const world = completeWorld(approvedOrder(), { settleThrows: error });
    await assert.rejects(world.complete(), new RegExp(error.message));
    assert.equal(took(world.log, "forget"), false, error.message);
    assert.equal(world.state.order?.paymentRef, PAYPAL_ORDER_ID, error.message);
    // PayPal is not even asked again: its "approved" would prove nothing
    assert.equal(world.log.filter((l) => l === "get").length, 1, error.message);
  }
  // Any 4xx is PayPal turning the call away
  for (const status of [400, 403, 422, 429]) {
    const world = completeWorld(approvedOrder(), { settleThrows: paypalError("REFUSED", status) });
    assert.deepEqual(await world.complete(), { status: "not_completed", code: "capture_failed" }, String(status));
  }
});

test("a payment that may have gone through, or may still, is answered 'unconfirmed' and the order keeps naming the PayPal order", async () => {
  // PayPal is holding the capture, took it and is giving it back, or left it in a state that isn't known
  for (const reason of ["capture_pending", "order_changed", "not_completed"] as const) {
    const world = completeWorld(approvedOrder(), { settled: { status: "open", reason } });
    assert.deepEqual(await world.complete(), { status: "unconfirmed", code: `settle_${reason}` }, reason);
    assert.equal(took(world.log, "forget"), false, reason);
    assert.equal(world.state.order?.paymentRef, PAYPAL_ORDER_ID, "PayPal's notification still finds the order when the money arrives");
  }

  // The same for a repeat of the call once PayPal shows the order completed with its capture still held
  const held = completeWorld(approvedOrder({ status: "COMPLETED", captured: true }), { order: openStoreOrder({ paymentRef: PAYPAL_ORDER_ID }), settled: { status: "open", reason: "capture_pending" } });
  assert.deepEqual(await held.complete(), { status: "unconfirmed", code: "settle_capture_pending" });
  assert.equal(took(held.log, "forget"), false);
});

test("a card payment settling on the same checkout stops the express payment before the order is touched", async () => {
  // The checkout's open order has a card payment going through (a wallet, or the card form in another tab)
  const order = openStoreOrder({ stripePaymentIntentId: "pi_settling" });
  const world = completeWorld(approvedOrder(), { order, cardInProgress: true });
  // PayPal takes nothing, but the buyer may well be charged by card: nothing is claimed
  assert.deepEqual(await world.complete(), { status: "unconfirmed", code: "card_in_progress" });
  assert.deepEqual(world.log, ["get", `find:${STORE_ORDER_ID}`, "card:pi_settling"], "not priced, not saved, not settled: the order ships to the address the card payment was made for");
  assert.equal(world.state.order, order);

  // Even with an address PayPal can't ship to or a changed price, the answer is never "you haven't been charged"
  for (const remote of [approvedOrder({ address: { country_code: "BR" } }), approvedOrder({ value: "64.99" })]) {
    const busy = completeWorld(remote, { order, cardInProgress: true });
    assert.equal((await busy.complete()).status, "unconfirmed");
  }

  // An order that named this PayPal order from an earlier call stops naming it: PayPal must not be captured on top of the card
  const named = completeWorld(approvedOrder(), { order: openStoreOrder({ stripePaymentIntentId: "pi_settling", paymentRef: PAYPAL_ORDER_ID }), cardInProgress: true });
  assert.deepEqual(await named.complete(), { status: "unconfirmed", code: "card_in_progress" });
  assert.equal(named.log.at(-1), FORGOT);

  // The card payment starting in the last moment, seen only by settling: the same answer, and PayPal is let go
  const late = completeWorld(approvedOrder(), { settled: { status: "open", reason: "card_in_progress" } });
  assert.deepEqual(await late.complete(), { status: "unconfirmed", code: "card_in_progress" });
  assert.equal(late.log.at(-1), FORGOT);

  // Once the card payment has marked the order paid, the same call answers "paid"
  const done = completeWorld(approvedOrder(), { order: openStoreOrder({ stripePaymentIntentId: "pi_settling", paymentStatus: "paid", status: "CONFIRMED", paymentRef: "pi_settling" }), cardInProgress: true });
  assert.equal((await done.complete()).status, "paid");
});

test("an earlier call's saved order stops naming the PayPal order when a later answer says nothing was charged", async () => {
  // The first call saved the order and its capture never finished (no answer from PayPal). The order names the
  // PayPal order, so PayPal's notification could still capture it. If the next call ends in "not charged", it must not
  const earlier = () => openStoreOrder({ paymentRef: PAYPAL_ORDER_ID });
  const cases: [ReturnType<typeof completeWorld>, string][] = [
    [completeWorld(approvedOrder(), { order: earlier(), pricing: priced(64.99) }), "price_changed"],
    [completeWorld(approvedOrder({ address: { country_code: "BR" } }), { order: earlier() }), "address_unusable"],
    [completeWorld(approvedOrder(), { order: earlier(), pricing: outOfStock }), "not_completed"],
    [completeWorld(approvedOrder(), { order: earlier(), saveError: "stock.notEnoughStock" }), "not_completed"],
    [completeWorld(approvedOrder({ status: "VOIDED" }), { order: earlier() }), "not_completed"],
  ];
  for (const [world, status] of cases) {
    assert.equal((await world.complete()).status, status);
    assert.equal(world.log.at(-1), FORGOT, status);
    assert.equal(world.state.order?.paymentRef, null, status);
  }
  // A phone number still owed is not an ending: the approval stays usable and the order is left alone
  const phone = completeWorld(approvedOrder({ payer: withoutPhone }), { order: earlier() });
  assert.deepEqual(await phone.complete(), { status: "needs_phone" });
  assert.equal(took(phone.log, "forget"), false);
  // With no order naming the PayPal order there is nothing to drop
  const fresh = completeWorld(approvedOrder(), { pricing: priced(64.99) });
  assert.deepEqual(await fresh.complete(), { status: "price_changed" });
  assert.equal(took(fresh.log, "forget"), false);
});

test("no answer about an express payment carries the buyer's details", async () => {
  const answers = [
    await completeWorld(approvedOrder()).complete(),
    await completeWorld(approvedOrder({ payer: withoutPhone })).complete(),
    await completeWorld(approvedOrder({ address: { admin_area_1: "PR" } })).complete(),
    await completeWorld(approvedOrder(), { pricing: priced(64.99) }).complete(),
    await completeWorld(approvedOrder(), { settled: { status: "open", reason: "capture_declined" } }).complete(),
    await completeWorld(approvedOrder(), { settled: { status: "open", reason: "capture_pending" } }).complete(),
  ];
  assert.deepEqual(answers.map((a) => a.status), ["paid", "needs_phone", "address_unusable", "price_changed", "not_completed", "unconfirmed"]);
  for (const answer of answers) {
    const text = JSON.stringify(answer).toLowerCase();
    for (const personal of ["buyer@example.com", "test customer", "payer", "123 test st", "washington", "20001", "2025550143", "token"]) {
      assert.ok(!text.includes(personal), `${answer.status}: ${personal}`);
    }
  }
});

/* ---------- PayPal express and the one path to "paid" ---------- */

/** PayPal and the store's order table as settling sees them. */
function settleDeps(remote: PayPalOrder) {
  const state = { remote, paidBy: null as string | null };
  const log: string[] = [];
  const deps: SettleDeps = {
    getOrder: async () => state.remote,
    capture: async () => {
      log.push("capture");
      state.remote = { ...state.remote, status: "COMPLETED", purchase_units: approvedOrder({ status: "COMPLETED", captured: true, referenceId: state.remote.purchase_units?.[0]?.reference_id }).purchase_units };
      return state.remote;
    },
    cardPaymentInProgress: async () => false,
    complete: async (_orderId, captureRef) => {
      if (state.paidBy) return false;
      state.paidBy = captureRef;
      log.push(`complete:${captureRef}`);
      return true;
    },
    paidRef: async () => state.paidBy,
    afterPaid: () => {
      log.push("afterPaid");
    },
    refundDuplicate: async (captureId) => {
      log.push(`refund:${captureId}`);
    },
    refundUnmatched: async ({ captureId }) => {
      log.push(`unmatched:${captureId}`);
    },
    forget: async () => {
      log.push("forget");
    },
  };
  return { deps, log, state };
}

test("an express payment is captured only for an order that already holds PayPal's address", async () => {
  // PayPal's notification can arrive before the buyer's browser has finished. If the checkout already had an
  // open order (details typed earlier), that order must not be paid until it names this PayPal order,
  // which happens in the same step that saves the address chosen in PayPal
  for (const paymentRef of [null, "OTHERPAYPALORDER1"]) {
    const early = settleDeps(approvedOrder());
    assert.deepEqual(await settlePayPalOrder(openStoreOrder({ paymentRef }), PAYPAL_ORDER_ID, early.deps), { status: "open", reason: "awaiting_details" });
    assert.deepEqual(early.log, [], "no capture, and nothing dropped from the order");
  }

  // Once the order names it, the same call captures once and runs the paid steps once
  const ready = settleDeps(approvedOrder());
  assert.deepEqual(await settlePayPalOrder(openStoreOrder({ paymentRef: PAYPAL_ORDER_ID }), PAYPAL_ORDER_ID, ready.deps), { status: "paid" });
  assert.deepEqual(ready.log, ["capture", "complete:CAP123", "afterPaid"]);

  // A PayPal order from the payment step (no express marker) settles as it always did, whatever the order names
  const step2 = settleDeps(approvedOrder({ referenceId: STORE_ORDER_ID }));
  assert.deepEqual(await settlePayPalOrder(openStoreOrder({ paymentRef: null }), PAYPAL_ORDER_ID, step2.deps), { status: "paid" });
  assert.deepEqual(step2.log, ["capture", "complete:CAP123", "afterPaid"]);
});

test("the browser's call and PayPal's notification completing the same express payment capture and notify once", async () => {
  const paypalSide = settleDeps(approvedOrder());
  const world = completeWorld(approvedOrder());
  world.deps.getPayPalOrder = paypalSide.deps.getOrder;
  world.deps.settle = (order, paypalOrderId) => settlePayPalOrder(order, paypalOrderId, paypalSide.deps);

  const [browser, again] = await Promise.all([world.complete(), world.complete()]);
  assert.equal(browser.status, "paid");
  assert.equal(again.status, "paid");
  // And the notification, finding the order by the PayPal order it now names
  assert.deepEqual(await settlePayPalOrder(openStoreOrder({ paymentRef: PAYPAL_ORDER_ID }), PAYPAL_ORDER_ID, paypalSide.deps), { status: "paid" });
  assert.equal(paypalSide.log.filter((l) => l === "capture").length <= 2, true);
  assert.equal(paypalSide.log.filter((l) => l.startsWith("complete:")).length, 1);
  assert.equal(paypalSide.log.filter((l) => l === "afterPaid").length, 1, "one confirmation, one Meta Purchase, one fulfillment request");
  assert.equal(paypalSide.log.filter((l) => l.startsWith("refund:")).length, 0);
});

/* ---------- the PayPal express button and its copy ---------- */

test("the PayPal express messages are the agreed wording", () => {
  assert.equal(en.checkout.expressPaypalPhone, "PayPal didn't share a phone number. Add one for the courier to finish your order.");
  assert.equal(en.checkout.expressPaypalComplete, "Complete order");
  assert.equal(en.checkout.expressPaypalAddress, "PayPal's shipping address can't be used for this order ({reason}). You haven't been charged. Enter your address below instead.");
  assert.equal(en.checkout.expressPaypalTotalChanged, "Your total changed. Please review your order and try again. You haven't been charged.");
  assert.equal(en.checkout.expressPaypalNotCompleted, "Your PayPal payment wasn't completed and you haven't been charged.");
  // When the server never answered, nothing is claimed about the charge
  assert.ok(!en.checkout.expressPaypalUnconfirmed.includes("haven't been charged"));
  for (const key of ["expressPaypalReasonCountry", "expressPaypalReasonState", "expressPaypalReasonPostal", "expressPaypalReasonAddress"] as const) {
    assert.ok(en.checkout[key].length > 0, key);
  }
});

test("the PayPal express button is PayPal only, follows the cart, and is a full-page trip in Meta's in-app browsers", async () => {
  const { readFile } = await import("node:fs/promises");
  const button = await readFile("src/components/checkout/paypal-express.tsx", "utf8");
  // One PayPal button: no card, no Pay Later, the shared SDK options
  assert.match(button, /fundingSource="paypal"/);
  assert.match(button, /paypalScriptOptions\(clientId\)/);
  assert.match(button, /forceReRender=\{\[cartKey\]\}/);
  // An address the cart can't ship to is turned away while the buyer is still in PayPal
  assert.match(button, /onShippingAddressChange=/);
  assert.match(button, /await actions\.reject\(\)/);
  assert.ok(!button.includes("onShippingChange="), "the deprecated callback isn't used");
  // The browser sends the PayPal order id and the cart, never an amount or an address, and never marks anything paid
  assert.ok(!button.includes("amount") && !button.includes("address1") && !button.includes("completePaidOrder"));
  assert.match(button, /const ROUTE = "\/api\/checkout\/paypal\/express"/);
  // A click while something else holds the details step never opens PayPal
  const click = button.slice(button.indexOf("onClick={"), button.indexOf("createOrder={"));
  assert.ok(click.includes("isLocked()") && click.includes("actions.reject()") && !click.includes("await"));

  const page = (await readFile("src/app/checkout/checkout-client.tsx", "utf8")).replace(/\r\n/g, "\n");
  // Wherever PayPal is offered (not without PayPal, not when switched off): in Meta's in-app browsers, where a pop-up
  // loses its page, the whole page goes to PayPal and back; elsewhere PayPal's pop-up button
  assert.match(page, /const paypalExpressOn = paypalExpress && paypal !== null && !!paypalClientId;/);
  assert.match(page, /paypalExpressOn && paypal === "redirect" \? \(\s+<PayPalExpressRedirect/);
  assert.match(page, /: paypalExpressOn && paypalClientId \? \(\s+<PayPalExpress\s/);
  // Back from approving in PayPal, the details step stays so that payment is completed there
  assert.match(page, /restore: express\?\.kind !== "return" &&/);
  const redirectButton = await readFile("src/components/checkout/paypal-express-redirect.tsx", "utf8");
  assert.match(redirectButton, /mode: "redirect"/);
  assert.match(redirectButton, /rememberExpressApproval\(json\.paypalOrderId/);
  assert.ok(!redirectButton.includes("amount") && !redirectButton.includes("address1"));
  const server = await readFile("src/app/checkout/page.tsx", "utf8");
  assert.match(server, /paypalExpress = !!paypalClientId && paypalExpressEnabled\(\)/);

  // The webhook is not part of express checkout: it creates no orders
  const webhook = await readFile("src/app/api/webhooks/paypal/route.ts", "utf8");
  assert.ok(!webhook.toLowerCase().includes("express") && !webhook.includes("createOrder"));
  // The route answers with a status only; the session token and the details stay on the server
  const route = await readFile("src/app/api/checkout/paypal/express/route.ts", "utf8");
  assert.ok(!route.includes("setResumeCookies") && !route.includes("resumeToken:") && !route.includes("sessionToken"));
});

/* ---------- what the buyer is told, end to end through the one path to "paid" ---------- */

test("an express order edited while PayPal was capturing is not paid, the capture goes back, and the buyer is not told 'not charged'", async () => {
  const paypalSide = settleDeps(approvedOrder());
  // The edit lands during the capture: the write that marks the order paid finds another total and refuses
  paypalSide.deps.complete = async () => false;
  const world = completeWorld(approvedOrder());
  world.deps.getPayPalOrder = paypalSide.deps.getOrder;
  world.deps.settle = (order, paypalOrderId) => settlePayPalOrder(order, paypalOrderId, paypalSide.deps);

  assert.deepEqual(await world.complete(), { status: "unconfirmed", code: "settle_order_changed" });
  assert.deepEqual(paypalSide.log, ["capture", "unmatched:CAP123", "forget"]);
  assert.equal(paypalSide.log.includes("afterPaid"), false);
});

test("a capture PayPal holds is answered 'unconfirmed', and PayPal's later notification pays the same order once", async () => {
  const paypalSide = settleDeps(approvedOrder());
  const captured = approvedOrder({ status: "COMPLETED", captured: true });
  const pending: PayPalOrder = { ...captured, purchase_units: captured.purchase_units?.map((unit) => ({ ...unit, payments: { captures: unit.payments?.captures?.map((c) => ({ ...c, status: "PENDING" })) } })) };
  paypalSide.deps.capture = async () => {
    paypalSide.log.push("capture");
    paypalSide.state.remote = pending;
    return pending;
  };
  const world = completeWorld(approvedOrder());
  world.deps.getPayPalOrder = paypalSide.deps.getOrder;
  world.deps.settle = (order, paypalOrderId) => settlePayPalOrder(order, paypalOrderId, paypalSide.deps);

  assert.deepEqual(await world.complete(), { status: "unconfirmed", code: "settle_capture_pending" });
  // The page asks once more: PayPal shows the order completed with its capture still held
  assert.deepEqual(await world.complete(), { status: "unconfirmed", code: "settle_capture_pending" });
  assert.equal(took(world.log, "forget"), false);
  assert.equal(world.state.order?.paymentRef, PAYPAL_ORDER_ID);
  assert.equal(paypalSide.log.filter((l) => l === "capture").length, 1, "captured once; the repeat only reads");

  // PAYMENT.CAPTURE.COMPLETED: the order is found by the PayPal order it names, and paid
  paypalSide.state.remote = captured;
  assert.ok(world.state.order);
  assert.deepEqual(await settlePayPalOrder(world.state.order, PAYPAL_ORDER_ID, paypalSide.deps), { status: "paid" });
  assert.equal(paypalSide.log.filter((l) => l === "afterPaid").length, 1);
});

test("after 'not charged' PayPal's notification can no longer capture the approved order", async () => {
  // The capture is refused; PayPal still shows the order approved, and its CHECKOUT.ORDER.APPROVED notification arrives late
  const paypalSide = settleDeps(approvedOrder());
  const world = completeWorld(approvedOrder(), { settleThrows: true });
  assert.deepEqual(await world.complete(), { status: "not_completed", code: "capture_failed" });
  assert.ok(world.state.order);
  assert.deepEqual(await settlePayPalOrder(world.state.order, PAYPAL_ORDER_ID, paypalSide.deps), { status: "open", reason: "awaiting_details" });
  assert.deepEqual(paypalSide.log, [], "no capture");
});

/* ---------- the browser's side of an approved payment ---------- */

test("only the route's own words count as 'not charged'; every other answer about an approved payment is unconfirmed", () => {
  // The route's answers
  assert.deepEqual(readExpressAnswer(200, { status: "paid", orderReference: "KTV-ZA4OG2CG", total: 59.99, contents: [] }), { status: "paid", orderReference: "KTV-ZA4OG2CG", total: 59.99, contents: [] });
  assert.deepEqual(readExpressAnswer(200, { status: "needs_phone" }), { status: "needs_phone" });
  assert.deepEqual(readExpressAnswer(200, { status: "price_changed" }), { status: "price_changed" });
  assert.deepEqual(readExpressAnswer(200, { status: "address_unusable", reason: "postal" }), { status: "address_unusable", reason: "postal" });
  assert.deepEqual(readExpressAnswer(200, { status: "address_unusable", reason: "<b>" }), { status: "address_unusable", reason: "address" });
  assert.deepEqual(readExpressAnswer(200, { status: "not_completed", code: "capture_failed" }), { status: "not_completed", code: "capture_failed" });
  assert.deepEqual(readExpressAnswer(200, { status: "unconfirmed", code: "settle_capture_pending" }), { status: "unconfirmed", code: "settle_capture_pending" });

  // The server failing, a proxy's error page, a rate limit, a block page, a body that isn't the route's JSON,
  // a status this page doesn't know: none of them says anything about the charge
  const unknown: [number, unknown][] = [
    [500, { error: "PAYMENT_CAPTURE_FAILED" }],
    [502, null],
    [503, null],
    [503, "<html>Service Unavailable</html>"],
    [503, { error: "upstream" }],
    [504, null],
    [429, { error: "rate limited" }],
    [403, null],
    [404, {}],
    [200, null],
    [200, "ok"],
    [200, []],
    [200, {}],
    [200, { status: "settled" }],
    [200, { status: "paid" }],
    [200, { status: "paid", orderReference: 42, total: "59.99" }],
    [302, { status: "not_completed", code: "x" }],
    [500, { status: "not_completed", code: "x" }],
  ];
  for (const [status, body] of unknown) {
    assert.equal(readExpressAnswer(status, body).status, "unconfirmed", `${status} ${JSON.stringify(body)}`);
  }

  // The route switched off answers before it reads anything: nothing was taken by that call...
  for (const error of ["PAYPAL_EXPRESS_OFF", "PAYPAL_NOT_CONFIGURED"]) {
    assert.deepEqual(readExpressAnswer(503, { error }), { status: "not_completed", code: "http_503" });
    // ...but an earlier call about the same approval may have taken the payment before its answer was lost
    assert.equal(readExpressAnswer(503, { error }, true).status, "unconfirmed");
  }
});

/** A stand-in for the browser's local storage. */
function withLocalStorage(run: (store: Map<string, string>) => void) {
  const store = new Map<string, string>();
  const g = globalThis as unknown as { localStorage?: object };
  const had = "localStorage" in g;
  const before = g.localStorage;
  g.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v); },
    removeItem: (k: string) => { store.delete(k); },
  };
  try {
    run(store);
  } finally {
    if (had) g.localStorage = before;
    else delete g.localStorage;
  }
}

test("the approval marker holds the PayPal order, the time and the cart for three hours, and nothing personal", () => {
  const now = 1_794_500_000_000;
  const cartKey = "p1:bluex1,p2x2";
  assert.equal(EXPRESS_APPROVAL_KEY, "kitvoy-ppx");
  assert.equal(EXPRESS_APPROVAL_TTL_MS, 3 * 60 * 60 * 1000);

  withLocalStorage((store) => {
    assert.equal(readExpressApproval(now), null);
    rememberExpressApproval(PAYPAL_ORDER_ID, cartKey, now);
    assert.deepEqual(JSON.parse(store.get(EXPRESS_APPROVAL_KEY) ?? "null"), { id: PAYPAL_ORDER_ID, at: now, cart: cartKey });
    assert.deepEqual(readExpressApproval(now + 1000), { id: PAYPAL_ORDER_ID, at: now, cart: cartKey });

    // Asking about the same approval again keeps its first time; three hours run from the approval
    rememberExpressApproval(PAYPAL_ORDER_ID, cartKey, now + 60 * 60 * 1000);
    assert.equal(readExpressApproval(now + 60 * 60 * 1000)?.at, now);
    assert.ok(readExpressApproval(now + EXPRESS_APPROVAL_TTL_MS - 1));
    assert.equal(readExpressApproval(now + EXPRESS_APPROVAL_TTL_MS), null, "expired");
    assert.equal(store.has(EXPRESS_APPROVAL_KEY), false, "an expired marker is removed when it is read");

    // A new approval replaces the old one
    rememberExpressApproval(PAYPAL_ORDER_ID, cartKey, now);
    rememberExpressApproval("9XY98765ZW432109K", "p1x1", now + 5000);
    assert.deepEqual(readExpressApproval(now + 5000), { id: "9XY98765ZW432109K", at: now + 5000, cart: "p1x1" });

    forgetExpressApproval();
    assert.equal(store.has(EXPRESS_APPROVAL_KEY), false);
    // What isn't a PayPal order id is never stored
    rememberExpressApproval("not an id", cartKey, now);
    rememberExpressApproval("", cartKey, now);
    assert.equal(store.has(EXPRESS_APPROVAL_KEY), false);
  });
});

test("a marker that is malformed, from the future, expired or for something that isn't a PayPal order is refused", () => {
  const now = 1_794_500_000_000;
  const good = { id: PAYPAL_ORDER_ID, at: now - 1000, cart: "p1x1" };
  assert.deepEqual(parseExpressApproval(JSON.stringify(good), now), good);
  // Only the three fields come back, whatever else was stored beside them
  assert.deepEqual(parseExpressApproval(JSON.stringify({ ...good, email: "buyer@example.com", token: "x" }), now), good);

  const bad: (string | null | undefined)[] = [
    null,
    undefined,
    "",
    "not json",
    "null",
    "[]",
    JSON.stringify({ ...good, id: "'; drop table orders;--" }),
    JSON.stringify({ ...good, id: 42 }),
    JSON.stringify({ ...good, id: STORE_ORDER_ID }),
    JSON.stringify({ ...good, at: "yesterday" }),
    JSON.stringify({ ...good, at: now - EXPRESS_APPROVAL_TTL_MS }),
    JSON.stringify({ ...good, at: now + 5 * 60 * 1000 }),
    JSON.stringify({ id: good.id, at: good.at }),
    JSON.stringify({ ...good, cart: 7 }),
    JSON.stringify({ ...good, cart: "x".repeat(5000) }),
  ];
  for (const raw of bad) assert.equal(parseExpressApproval(raw, now), null, String(raw));
});

test("a wallet payment is only called 'not charged' when Stripe refused it", () => {
  assert.equal(walletConfirmOutcome({ intentStatus: "succeeded" }), "paid");
  assert.equal(walletConfirmOutcome({ intentStatus: "processing" }), "paid");
  // A declined card or details Stripe wouldn't take: nothing was charged
  assert.equal(walletConfirmOutcome({ errorType: "card_error" }), "refused");
  assert.equal(walletConfirmOutcome({ errorType: "validation_error" }), "refused");
  assert.equal(walletConfirmOutcome({ intentStatus: "requires_payment_method" }), "refused");
  // A lost connection or an error at Stripe: the payment may have gone through without the page hearing of it
  for (const errorType of ["api_connection_error", "api_error", "rate_limit_error", "idempotency_error", "invalid_request_error", "authentication_error"]) {
    assert.equal(walletConfirmOutcome({ errorType }), "unknown", errorType);
    assert.equal(walletConfirmOutcome({ errorType, intentStatus: "succeeded" }), "unknown", "an error is never read as a payment");
  }
  for (const intentStatus of ["requires_action", "requires_confirmation", "requires_capture", "canceled", undefined]) {
    assert.equal(walletConfirmOutcome({ intentStatus }), "unknown", String(intentStatus));
  }
});

test("the express buttons say 'not charged' only where it is known, keep the approval until its outcome is, and count as the buyer using the page", async () => {
  const { readFile } = await import("node:fs/promises");
  const read = async (path: string) => (await readFile(path, "utf8")).replace(/\r\n/g, "\n");

  const button = await read("src/components/checkout/paypal-express.tsx");
  // The answer is read by the tested reader, and a second ask is marked as one
  assert.match(button, /return readExpressAnswer\(res\.status, await res\.json\(\)\.catch\(\(\) => null\), askedBefore\);/);
  assert.match(button, /return askToComplete\(body, true\);/);
  assert.ok(!button.includes("res.status !== 503"), "a proxy's 503 is not proof that nothing was charged");
  // The marker is written before the server is asked, and dropped only on an answer that settles the matter
  const finish = button.slice(button.indexOf("const finish = async"), button.indexOf("const submitPhone"));
  assert.ok(finish.indexOf("rememberExpressApproval(paypalOrderId, latest.current.cartKey)") > 0);
  assert.ok(finish.indexOf("rememberExpressApproval(paypalOrderId, latest.current.cartKey)") < finish.indexOf("await completeOnServer("));
  assert.match(finish, /if \(answer\.status !== "unconfirmed" && answer\.status !== "needs_phone"\) forgetExpressApproval\(\);/);
  // "Not charged" is shown for the server's not_completed only; unconfirmed and a thrown error get the neutral notice
  const notCharged = finish.slice(finish.indexOf('case "not_completed":'));
  assert.ok(notCharged.includes("notCompleted();"));
  const unconfirmed = finish.slice(finish.indexOf('case "unconfirmed":'), finish.indexOf('case "not_completed":'));
  assert.ok(unconfirmed.includes('say("checkout.expressPaypalUnconfirmed")') && !unconfirmed.includes("notCompleted()"));
  assert.ok(!finish.includes("default:"), "an answer the page doesn't know is never shown as 'not charged'");
  // On load the server is asked again about an approval for this cart; a press while one is open asks again too
  assert.match(button, /const approval = readExpressApproval\(\);\s+if \(approval && approval\.cart === latest\.current\.cartKey\) void finishRef\.current\(approval\.id, \{ resumed: true \}\);/);
  const click = button.slice(button.indexOf("onClick={"), button.indexOf("createOrder={"));
  assert.match(click, /if \(earlier && earlier\.cart === latest\.current\.cartKey\) \{[^]*?finishRef\.current\(earlier\.id, \{ resumed: true \}\);\s+return actions\.reject\(\);/);

  const page = await read("src/app/checkout/checkout-client.tsx");
  // A press on an express button marks the buyer as using the page, so a late resume answer leaves it alone
  assert.match(page, /notify: \(message\) => \{[^}]*userActed\.current = true;\s+setExpressNotice\(message\);\s+\},/);
  // A finished checkout leaves no approval behind to be asked about again
  const paid = page.slice(page.indexOf("const handlePaid ="), page.indexOf("const expressHost"));
  assert.ok(paid.includes("forgetExpressApproval();"));

  const wallet = await read("src/components/checkout/express-checkout.tsx");
  const confirm = wallet.slice(wallet.indexOf("const outcome = walletConfirmOutcome("), wallet.indexOf("} catch {", wallet.indexOf("const outcome = walletConfirmOutcome(")));
  // Refused: Stripe's message and the intent's secret. Unknown: the neutral message and no secret
  assert.match(confirm, /if \(outcome === "refused"\) \{[^}]*onReviewPayment\(details, order, confirmError\?\.message \?\? t\("checkout\.paymentFailed"\), intent\.clientSecret\);/);
  assert.match(confirm, /\} else \{[^}]*onReviewPayment\(details, order, t\("order\.errorGeneric"\)\);/);
  assert.ok(!en.order.errorGeneric.includes("charged"));

  // The route passes the pieces that keep "not charged" true
  const route = await read("src/app/api/checkout/paypal/express/route.ts");
  assert.match(route, /forget: settleDeps\.forget,/);
  assert.match(route, /cardPaymentInProgress: settleDeps\.cardPaymentInProgress,/);
});
