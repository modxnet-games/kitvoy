import test from "node:test";
import assert from "node:assert/strict";

import { catalog, getCatalogVariant, mainProduct, variantKey, variantLabel } from "../src/config/catalog";
import { policyLinks, storePolicies } from "../src/config/policies";
import { policyContent } from "../src/config/policy-content";
import { getProductEntry, productEntries } from "../src/config/products";
import { siteConfig } from "../src/config/site";
import { getBundleSavings, getLineTotal, lineSavings, priceLines } from "../src/lib/bundles";
import { sanitizeCheckoutEvent } from "../src/lib/checkout/events";
import { CHECKOUT_FIELDS, readCheckoutDetails, validateCheckoutDetails } from "../src/lib/checkout-details";
import { formatPrice } from "../src/lib/formatters";
import { LOCALES, dirOf, interpolate, isLocale, localeFromAcceptLanguage } from "../src/lib/i18n";
import { CITIES, formatMoroccanPhone, parseMoroccanPhone, westernDigits, whatsappLink } from "../src/lib/morocco";
import { orderReferenceOf } from "../src/lib/order-reference";
import { parseCartItems, validateOrderInput } from "../src/lib/orders";
import { productFaqs } from "../src/lib/product-faq";
import { salePush } from "../src/lib/push/admin-devices";
import { catalogProductSchema, returnPolicySchema } from "../src/lib/seo/structured-data";
import { getMessages, translate } from "../src/messages";
import type { ProductDisplay } from "../src/types/product";

const NBSP = " ";
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
/** Every string in a nested copy object, with its dotted path. */
function strings(node: unknown, path = ""): [string, string][] {
  if (typeof node === "string") return [[path, node]];
  if (Array.isArray(node)) return node.flatMap((item, i) => strings(item, `${path}[${i}]`));
  if (node && typeof node === "object") return Object.entries(node).flatMap(([key, value]) => strings(value, path ? `${path}.${key}` : key));
  return [];
}

test("prices are dirhams: whole amounts without decimals, in each language", () => {
  assert.equal(formatPrice(199, "fr"), `199${NBSP}DH`);
  assert.equal(formatPrice(199, "ar"), `199${NBSP}درهم`);
  assert.equal(formatPrice(199, "en"), `199${NBSP}MAD`);
  assert.equal(formatPrice(199), `199${NBSP}DH`, "French is the default (admin, emails, push)");
  assert.equal(formatPrice(174.5, "fr"), `174,50${NBSP}DH`);
  assert.equal(formatPrice(174.5, "en"), `174.50${NBSP}MAD`);
  assert.equal(formatPrice(1250, "fr"), `1 250${NBSP}DH`);
  assert.equal(formatPrice(0, "ar"), `0${NBSP}درهم`);
});

test("the packs cost 199, 350 and 450 dirhams, and the savings are real", () => {
  const slug = mainProduct.slug;
  assert.deepEqual([1, 2, 3].map((q) => getLineTotal(199, q, slug)), [199, 350, 450]);
  assert.deepEqual([1, 2, 3].map((q) => getBundleSavings(199, q, slug)), [0, 48, 147]);
  assert.equal(getLineTotal(199, 4, slug), 597, "from the fourth piece each is 25% off");
  // Each pack is a round number of dirhams per piece
  assert.equal(350 / 2, 175);
  assert.equal(450 / 3, 150);
  // A much cheaper price set in the admin can't push a pack past the cap
  assert.ok(getLineTotal(100, 3, slug) >= 100 * 3 * (1 - mainProduct.maxDiscount));
  // A product outside the catalog has no packs
  assert.equal(getLineTotal(199, 3, "unknown"), 597);
});

test("a pack mixed across colours and sizes is still one pack, split to the centime", () => {
  const lines = [
    { productId: "p", slug: mainProduct.slug, unitPrice: 199, quantity: 1 },
    { productId: "p", slug: mainProduct.slug, unitPrice: 199, quantity: 1 },
    { productId: "p", slug: mainProduct.slug, unitPrice: 199, quantity: 1 },
  ];
  assert.deepEqual(priceLines(lines), [150, 150, 150]);
  assert.deepEqual(lineSavings(lines), [49, 49, 49]);
  const uneven = priceLines([{ productId: "p", slug: mainProduct.slug, unitPrice: 199, quantity: 2 }, { productId: "p", slug: mainProduct.slug, unitPrice: 199, quantity: 1 }]);
  assert.equal(Math.round((uneven[0] + uneven[1]) * 100), 45000);
});

test("the catalog names every colour and size, and a variant key resolves both", () => {
  assert.equal(catalog.length, 1);
  assert.equal(mainProduct.path, "/");
  assert.deepEqual(mainProduct.sizes, ["S", "M", "L", "XL", "XXL", "XXXL"]);
  assert.deepEqual(mainProduct.colours.map((c) => c.key), ["black", "nude", "leopard"]);
  for (const colour of mainProduct.colours) {
    for (const locale of LOCALES) assert.ok(colour.label[locale], `${colour.key} has a ${locale} name`);
    assert.match(colour.image, /^\/products\/sanadi\/colour-[a-z]+\.webp$/);
  }
  const variant = getCatalogVariant("sanadi", "leopard-xxl");
  assert.equal(variant?.sku, "SND-LEO-XXL");
  assert.equal(variant?.key, variantKey("leopard", "XXL"));
  assert.equal(variantLabel(variant!, "fr"), "Léopard · XXL");
  assert.equal(variantLabel(variant!, "ar"), "نمري · XXL");
  for (const bad of ["black", "black-", "-xl", "pink-xl", "black-xs", "", null, undefined]) assert.equal(getCatalogVariant("sanadi", bad), undefined, String(bad));
  assert.equal(getCatalogVariant("other", "black-xl"), undefined);
  // 18 distinct SKUs
  const skus = mainProduct.colours.flatMap((c) => mainProduct.sizes.map((s) => getCatalogVariant("sanadi", variantKey(c.key, s))!.sku));
  assert.equal(new Set(skus).size, 18);
});

test("Moroccan phone numbers are read however they are typed", () => {
  for (const typed of ["0612345678", "06 12 34 56 78", "06-12-34-56-78", "06.12.34.56.78", "+212612345678", "+212 6 12 34 56 78", "00212612345678", "212612345678", "612345678", "٠٦١٢٣٤٥٦٧٨"]) {
    assert.deepEqual(parseMoroccanPhone(typed), { national: "0612345678", e164: "+212612345678" }, typed);
  }
  assert.equal(parseMoroccanPhone("0712345678")?.e164, "+212712345678");
  assert.equal(parseMoroccanPhone("0522334455")?.national, "0522334455");
  for (const bad of ["", "061234567", "06123456789", "0412345678", "0812345678", "+33612345678", "abcdefghij", null, undefined]) assert.equal(parseMoroccanPhone(bad), null, String(bad));
  assert.equal(formatMoroccanPhone("0612345678"), "06 12 34 56 78");
  assert.equal(whatsappLink("06 12 34 56 78"), "https://wa.me/212612345678");
  assert.equal(whatsappLink("0612345678", "Bonjour CHR-1"), "https://wa.me/212612345678?text=Bonjour%20CHR-1");
  assert.equal(whatsappLink("12345"), null);
  assert.equal(westernDigits("٠١٢٣٤٥٦٧٨٩ ۰۱۲۳۴۵۶۷۸۹"), "0123456789 0123456789");
  assert.ok(CITIES.length >= 40);
  assert.equal(new Set(CITIES.map((c) => c.fr)).size, CITIES.length, "no city twice");
  for (const city of CITIES) assert.ok(city.fr && city.ar);
});

test("the order form asks for a name, a Moroccan phone, a city and an address, and nothing else", () => {
  assert.deepEqual(CHECKOUT_FIELDS, ["fullName", "phone", "city", "address"]);
  const good = readCheckoutDetails({ fullName: "  Salma   Bennani ", phone: " 06 12 34 56 78 ", city: "Casablanca", address: "Maarif, rue 12, n° 5", email: "x@y.z" });
  assert.deepEqual(good, { fullName: "Salma Bennani", phone: "06 12 34 56 78", city: "Casablanca", address: "Maarif, rue 12, n° 5" });
  assert.deepEqual(validateCheckoutDetails(good), {});
  assert.deepEqual(validateCheckoutDetails(readCheckoutDetails({ fullName: "فاطمة العلوي", phone: "٠٦١٢٣٤٥٦٧٨", city: "سلا", address: "حي السلام رقم 4" })), {}, "Arabic input passes");
  assert.deepEqual(validateCheckoutDetails(readCheckoutDetails({})), {
    fullName: "validation.fullName",
    phone: "validation.phone",
    city: "validation.city",
    address: "validation.address",
  });
  assert.equal(validateCheckoutDetails({ ...good, phone: "123" }).phone, "validation.phone");
  assert.equal(validateCheckoutDetails({ ...good, fullName: "12" }).fullName, "validation.fullName");
  assert.equal(validateCheckoutDetails({ ...good, address: "..." }).address, "validation.address");
  // Every error key has words in both languages
  for (const locale of LOCALES) for (const key of Object.values(validateCheckoutDetails(readCheckoutDetails({})))) assert.notEqual(translate(locale, key), key);
  // Over-long input is cut, never rejected
  assert.equal(readCheckoutDetails({ address: "x".repeat(500) }).address.length, 200);
});

test("an order request is checked before anything is priced", () => {
  const details = { fullName: "Salma Bennani", phone: "0612345678", city: "Rabat", address: "Agdal, avenue de France 10" };
  const items = [{ productId: "cmws7h6t70002cbqlqgf35e17", quantity: 2, variantKey: "black-m" }];
  const ok = validateOrderInput({ ...details, locale: "fr", items });
  assert.ok(ok.valid);
  assert.deepEqual(ok.valid && ok.data.items, items);
  assert.equal(ok.valid && ok.data.locale, "fr");
  assert.equal((validateOrderInput({ ...details, items }) as { data: { locale: string } }).data.locale, "ar", "the default language is Arabic");
  // The hidden field no person fills in
  assert.deepEqual(validateOrderInput({ ...details, items, website: "http://spam" }), { valid: false, error: "order.errorGeneric" });
  const bad = validateOrderInput({ ...details, phone: "12", items });
  assert.equal(bad.valid, false);
  assert.equal(!bad.valid && bad.error, "validation.phone");
  assert.deepEqual(!bad.valid && bad.fields, { phone: "validation.phone" });
  assert.deepEqual(validateOrderInput({ ...details, items: [] }), { valid: false, error: "order.errorEmptyCart" });
  assert.equal(validateOrderInput(null).valid, false);
  // Cart lines: prices and names from the browser are ignored, junk is dropped
  assert.deepEqual(
    parseCartItems([
      { product: { id: "abc123", price: 1, name: "Free" }, quantity: 1, variantKey: "nude-l" },
      { productId: "abc123", quantity: 0 },
      { productId: "abc123", quantity: 1.5 },
      { productId: "abc123", quantity: 99 },
      { productId: "../etc", quantity: 1 },
      { productId: "abc123", quantity: 1, variantKey: "DROP TABLE" },
      "nonsense",
    ]),
    [
      { productId: "abc123", quantity: 1, variantKey: "nude-l" },
      { productId: "abc123", quantity: 1, variantKey: null },
    ],
  );
  assert.equal(orderReferenceOf("cmws7h6t70002cbqlqgf35e17"), "CHR-QGF35E17");
});

test("Arabic and French say the same things: same keys, same placeholders", () => {
  const fr = strings(getMessages("fr"));
  const ar = new Map(strings(getMessages("ar")));
  assert.equal(ar.size, fr.length);
  for (const [path, text] of fr) {
    const other = ar.get(path);
    assert.ok(other, `Arabic is missing ${path}`);
    assert.deepEqual(placeholders(other!), placeholders(text), `placeholders differ at ${path}`);
    assert.ok(text.trim() && other!.trim(), `${path} is empty`);
  }
  assert.equal(translate("fr", "cart.items", { count: 3 }), "3 article(s)");
  assert.equal(translate("ar", "no.such.key"), "no.such.key");
  assert.equal(interpolate("{a} + {b}", { a: 1, b: "x" }), "1 + x");
  assert.equal(dirOf("ar"), "rtl");
  assert.equal(dirOf("fr"), "ltr");
  assert.ok(isLocale("ar") && isLocale("fr") && !isLocale("en") && !isLocale(undefined));
  assert.equal(localeFromAcceptLanguage("fr-FR,fr;q=0.9,en;q=0.8"), "fr");
  assert.equal(localeFromAcceptLanguage("ar-MA,ar;q=0.9,fr;q=0.8"), "ar");
  assert.equal(localeFromAcceptLanguage("en-US,en;q=0.9"), "ar", "anything else gets the default");
  assert.equal(localeFromAcceptLanguage("en-US,fr;q=0.5,ar;q=0.4"), "fr", "the first of the two that appears wins");
  assert.equal(localeFromAcceptLanguage(null), "ar");
});

test("the product copy is complete in both languages and follows the owner's rules", () => {
  const page = getProductEntry("sanadi")!;
  assert.equal(productEntries.length, 1);
  const { fr, ar } = page.content;
  assert.deepEqual(fr.gallery.map((g) => g.src), ar.gallery.map((g) => g.src), "the same photos in the same order");
  assert.ok(fr.gallery.length >= 5, "five gallery photos, plus stand-ins the page uses while one is missing");
  for (const key of ["features", "facts", "faq", "included"] as const) assert.equal(fr[key].length, ar[key].length, key);
  assert.equal(fr.howItWorks.steps.length, 3);
  assert.equal(ar.howItWorks.steps.length, 3);
  assert.equal(fr.transformation?.before.src, ar.transformation?.before.src);
  for (const [path, text] of [...strings(fr, "fr"), ...strings(ar, "ar")]) {
    assert.ok(text.trim(), `${path} is empty`);
    assert.doesNotMatch(text, /kitvoy|fonder|alibaba|shantou/i, `${path} names another brand`);
    assert.doesNotMatch(text, /\{\w+\}/, `${path} has an unfilled placeholder`);
  }
  // The size guide covers every size the product is sold in, and every usual size appears once
  assert.deepEqual(page.sizeGuide.rows.map((r) => r.size), mainProduct.sizes);
  const usual = page.sizeGuide.rows.flatMap((r) => r.usual);
  assert.equal(new Set(usual).size, usual.length);
  for (const size of usual) assert.match(size, /^(85|90|95|100|105|110|115)[A-E]$/);
  assert.deepEqual(page.sizeGuide.bands.map((b) => b.band), ["85", "90", "95", "100", "105", "110", "115"]);
  assert.equal(page.database.price, 199);
});

test("the FAQ states the delivery, payment, exchange and pack terms from the config", () => {
  for (const locale of LOCALES) {
    const page = getProductEntry("sanadi")!.content[locale];
    const faqs = productFaqs(page, mainProduct, locale, 199);
    assert.equal(faqs.length, page.faq.length + 4);
    const text = faqs.map((f) => `${f.q} ${f.a}`).join(" ");
    assert.doesNotMatch(text, /\{\w+\}/);
    for (const figure of ["24", "72", String(storePolicies.exchange.windowDays), formatPrice(350, locale), formatPrice(48, locale), formatPrice(450, locale), formatPrice(147, locale)]) {
      assert.ok(text.includes(figure), `${locale} FAQ should mention ${figure}`);
    }
    // Without a price there is no pack answer
    assert.equal(productFaqs(page, mainProduct, locale, null).length, page.faq.length + 3);
  }
});

test("the policy pages exist in both languages, with every term filled in", () => {
  const terms = { min: mainProduct.deliveryHours.min, max: mainProduct.deliveryHours.max, days: storePolicies.exchange.windowDays };
  assert.deepEqual(policyLinks.map((l) => l.href), ["/shipping", "/returns", "/privacy", "/terms"]);
  for (const { key } of policyLinks) {
    const fr = policyContent.fr.docs[key];
    const ar = policyContent.ar.docs[key];
    assert.deepEqual(fr.sections.map((s) => s.id), ar.sections.map((s) => s.id), `${key}: same sections`);
    for (const doc of [fr, ar]) {
      for (const [path, text] of strings(doc, key)) {
        if (path.endsWith(".id")) continue;
        assert.ok(text.trim());
        assert.doesNotMatch(interpolate(text, terms), /\{\w+\}/, `${path} has an unknown placeholder`);
        assert.doesNotMatch(text, /kitvoy|stripe|paypal|usd|\$/i, `${path} still speaks of the old store`);
      }
    }
  }
  assert.match(interpolate(policyContent.fr.docs.returns.sections[0].heading, terms), /7 jours/);
  assert.match(interpolate(policyContent.fr.docs.shipping.description, terms), /24 à 72 heures/);
});

test("search markup: dirhams, Morocco, one offer per colour and size, the exchange window", () => {
  const product = { id: "p1", slug: "sanadi", name: "Sanadi", price: 199, shippingTax: 0, stock: 12, sku: "SND-001" } as ProductDisplay;
  const schema = catalogProductSchema(product, mainProduct, getProductEntry("sanadi")!.content.fr);
  assert.equal(schema.offers.length, 18);
  for (const offer of schema.offers) {
    assert.equal(offer.priceCurrency, "MAD");
    assert.equal(offer.price, 199);
    assert.equal(offer.availability, "https://schema.org/InStock");
    assert.equal(offer.shippingDetails.shippingDestination.addressCountry, "MA");
    assert.equal(offer.shippingDetails.shippingRate.value, 0);
    assert.deepEqual([offer.shippingDetails.deliveryTime.transitTime.minValue, offer.shippingDetails.deliveryTime.transitTime.maxValue], [1, 3]);
  }
  assert.equal(schema.brand.name, siteConfig.name);
  assert.equal(returnPolicySchema().merchantReturnDays, 7);
  assert.equal(returnPolicySchema().applicableCountry, "MA");
  assert.ok(!("aggregateRating" in schema) && !("review" in schema), "no ratings are claimed");
  assert.equal(catalogProductSchema({ ...product, stock: 0 }, mainProduct, getProductEntry("sanadi")!.content.ar).offers[0].availability, "https://schema.org/OutOfStock");
});

test("the phone notification for a new order says who, where, how many and how much", () => {
  const push = salePush({ id: "abc", reference: "CHR-1A2B3C4D", customerName: "Salma Bennani", city: "Rabat", total: 350, itemCount: 2 });
  assert.equal(push.title, `New order · 350${NBSP}DH`);
  assert.equal(push.body, "Salma Bennani · Rabat · 2 pcs · CHR-1A2B3C4D");
  assert.deepEqual(push.data, { type: "sale", orderId: "abc", reference: "CHR-1A2B3C4D", total: "350.00" });
  assert.equal(salePush({ id: "abc", reference: "CHR-1", customerName: "A", total: 199, itemCount: 1 }).body, "A · 1 pc · CHR-1");
});

test("the checkout log only takes known events, and never free text", () => {
  assert.deepEqual(sanitizeCheckoutEvent({ e: "order_placed", ref: "CHR-1A2B3C4D", step: 2, ms: 884.4, w: 390, sid: "kb8eiw6c", name: "Salma" }), { e: "order_placed", ref: "CHR-1A2B3C4D", step: 2, ms: 884, w: 390, sid: "kb8eiw6c" });
  assert.deepEqual(sanitizeCheckoutEvent({ e: "order_failed", code: "order.errorTooMany" }), { e: "order_failed", code: "order.errorTooMany" });
  assert.deepEqual(sanitizeCheckoutEvent({ e: "order_invalid", code: "phone number 0612345678" }), { e: "order_invalid" }, "a code with spaces is dropped");
  assert.equal(sanitizeCheckoutEvent({ e: "details_saved" }), null);
  assert.equal(sanitizeCheckoutEvent("order_placed"), null);
});
