import assert from "node:assert/strict";
import test from "node:test";

import { catalog, countriesForCart, getCatalogProduct, getCatalogVariant, productPath, shipsTo } from "../src/config/catalog";
import { getProductContent, productContents } from "../src/config/products";
import { getBundleSavings, getLineTotal, lineSavings, priceLines } from "../src/lib/bundles";
import { validateOrderInput } from "../src/lib/orders";
import { productFaqs } from "../src/lib/product-faq";
import { COUNTRY_RULES, countryOf, formatAddressLine, toShippingAddress, validateCheckoutDetails, type CheckoutDetails } from "../src/lib/us-address";
import { withVariant, type ProductDisplay } from "../src/types/product";

const ball = getCatalogProduct("pouncepop")!;
const content = getProductContent("pouncepop")!;

const usDetails: CheckoutDetails = {
  email: "buyer@example.com", fullName: "Test Buyer", phone: "(202) 555-0143", address1: "1600 Example Ave", address2: "",
  city: "Washington", state: "DC", zip: "20001", country: "US",
};

test("every catalog product has a page, tiers that start at one unit and a SKU per colour", () => {
  assert.deepEqual(catalog.map((p) => p.path).sort(), ["/products/pouncepop"]);
  for (const product of catalog) {
    assert.equal(product.tiers[0].quantity, 1);
    assert.equal(product.tiers[0].discount, 0);
    assert.ok(product.variants.length >= 1);
    assert.equal(product.hasColourChoice, product.variants.length > 1);
    assert.equal(new Set(product.variants.map((v) => v.sku)).size, product.variants.length);
    assert.ok(shipsTo(product.slug).includes("US"));
  }
  assert.equal(productPath("pouncepop"), "/products/pouncepop");
  assert.equal(productPath("unknown"), "/", "a product outside the catalog leads to the storefront");
});

test("PouncePop packs are $29.99, $49.99 and $64.99, with savings counted against the single price only", () => {
  assert.deepEqual([1, 2, 3].map((q) => getLineTotal(29.99, q, "pouncepop")), [29.99, 49.99, 64.99]);
  assert.deepEqual([1, 2, 3].map((q) => getBundleSavings(29.99, q, "pouncepop")), [0, 9.99, 24.98]);
  // Savings are exactly N x the single price minus the pack price: no "was" price exists
  assert.equal(getBundleSavings(29.99, 3, "pouncepop"), Math.round((3 * 29.99 - 64.99) * 100) / 100);
  assert.equal(getLineTotal(29.99, 4, "pouncepop"), 89.97, "from the fourth ball every ball is 25% off");
  assert.ok(getLineTotal(29.99, 4, "pouncepop") / 4 >= getLineTotal(29.99, 3, "pouncepop") / 3, "a bigger order never undercuts the best pack per ball");
  assert.ok(getLineTotal(29.99, 2, "pouncepop") / 2 > getLineTotal(29.99, 3, "pouncepop") / 3, "three are the best value per ball");
  // An admin price cut can't push a fixed discount past the cap
  assert.ok(getLineTotal(10, 3, "pouncepop") >= 30 * (1 - ball.maxDiscount) - 0.005);
  // The store's original rule remains the rule for a product outside the catalog
  assert.deepEqual([1, 2, 3].map((q) => getLineTotal(59.99, q, "something-else")), [59.99, 99.99, 134.98]);
  assert.deepEqual([1, 2, 3].map((q) => getLineTotal(59.99, q)), [59.99, 99.99, 134.98]);
});

test("a product bought in several colours is one bundle, split across its lines to the cent", () => {
  const line = (quantity: number) => ({ productId: "p1", slug: "pouncepop", unitPrice: 29.99, quantity });
  const two = priceLines([line(1), line(1)]);
  assert.equal(Math.round((two[0] + two[1]) * 100), 4999, "one orange and one blue cost the 2-pack price");
  const three = priceLines([line(2), line(1)]);
  assert.equal(Math.round((three[0] + three[1]) * 100), 6499);
  assert.ok(three[0] > three[1]);
  assert.equal(Math.round(lineSavings([line(1), line(1), line(1)]).reduce((a, b) => a + b, 0) * 100), 2498);
  // Different products never share a bundle
  const mixed = priceLines([line(1), { productId: "p2", slug: "something-else", unitPrice: 59.99, quantity: 1 }]);
  assert.deepEqual(mixed, [29.99, 59.99]);
  assert.deepEqual(priceLines([]), []);
});

test("checkout accepts an address only in a listed country, with that country's own rules", () => {
  assert.deepEqual(validateCheckoutDetails(usDetails), {});
  // No country at all is a US address: checkouts opened before the store shipped abroad
  const { country: _omit, ...legacy } = usDetails;
  void _omit;
  assert.deepEqual(validateCheckoutDetails(legacy), {});
  assert.equal(toShippingAddress(legacy).country, "US");

  const de: CheckoutDetails = { ...usDetails, country: "DE", phone: "+49 30 1234567", city: "Berlin", state: "", zip: "10115" };
  assert.deepEqual(validateCheckoutDetails(de), {}, "Germany needs no region");
  assert.equal(validateCheckoutDetails({ ...de, zip: "1011" }).zip, "validation.postal");
  assert.equal(validateCheckoutDetails({ ...de, phone: "12" }).phone, "validation.phoneIntl");

  const gb: CheckoutDetails = { ...usDetails, country: "GB", phone: "07700 900123", city: "London", state: "", zip: "sw1a 1aa" };
  assert.deepEqual(validateCheckoutDetails(gb), {});
  assert.equal(toShippingAddress(gb).zip, "SW1A 1AA");

  const mx: CheckoutDetails = { ...usDetails, country: "MX", phone: "55 1234 5678", city: "Ciudad de México", state: "", zip: "06000" };
  assert.equal(validateCheckoutDetails(mx).state, "validation.region", "Mexico needs a state");
  assert.deepEqual(validateCheckoutDetails({ ...mx, state: "CDMX" }), {});

  const cl: CheckoutDetails = { ...usDetails, country: "CL", phone: "+56 9 1234 5678", city: "Santiago", state: "Región Metropolitana", zip: "" };
  assert.deepEqual(validateCheckoutDetails(cl), {}, "Chile's postal code is optional");
  assert.equal(validateCheckoutDetails({ ...cl, zip: "123" }).zip, "validation.postal");

  // Brazil is not offered, and nothing outside the list is accepted
  assert.equal("BR" in COUNTRY_RULES, false);
  assert.equal(validateCheckoutDetails({ ...usDetails, country: "BR" as never }).country, "validation.country");
  const body = { ...usDetails, items: [{ product: { id: "p1", slug: "pouncepop", name: "PouncePop", price: 29.99 }, quantity: 1, variantKey: "blue" }] };
  assert.equal(validateOrderInput({ ...body, country: "BR" }).valid, false);
  const ok = validateOrderInput({ ...body, country: "de", state: "", zip: "10115", phone: "+49 30 1234567" });
  assert.ok(ok.valid);
  assert.equal(ok.data.shippingAddress.country, "DE");
  assert.equal(ok.data.items[0].variantKey, "blue");

  assert.equal(formatAddressLine(toShippingAddress(usDetails)), "1600 Example Ave, Washington, DC 20001");
  assert.equal(formatAddressLine(toShippingAddress(de)), "1600 Example Ave, Berlin, 10115, Germany");
  assert.equal(countryOf({ country: "MX" }), "MX");
  assert.equal(countryOf({}), "US");
  assert.equal(countryOf(null), "US");
});

test("a cart ships only where every product in it ships", () => {
  assert.deepEqual(shipsTo("something-else"), ["US"], "a product outside the catalog ships to the US only");
  assert.deepEqual(shipsTo("pouncepop"), ["US", "GB", "DE", "FR", "NL", "ES", "MX", "CL"]);
  assert.deepEqual(countriesForCart(["pouncepop"]), ["US", "GB", "DE", "FR", "NL", "ES", "MX", "CL"]);
  assert.deepEqual(countriesForCart(["pouncepop", "something-else"]), ["US"], "with a product from outside the catalog in the cart, the order can only go to the US");
  assert.deepEqual(countriesForCart(["something-else"]), ["US"]);
});

test("the cart tells colours apart", () => {
  const product = { id: "p1", slug: "pouncepop", name: "PouncePop", sku: "PET-001", images: ["/a.webp", "/blue.webp"] } as ProductDisplay;
  const blue = withVariant(product, { key: "blue", label: "Blue", sku: "PET-001-BL", image: "/blue.webp" });
  assert.equal(blue.sku, "PET-001-BL", "the colour's SKU is what tracking uses");
  assert.deepEqual(blue.images, ["/blue.webp", "/a.webp"], "the colour's photo leads the cart line");
  assert.deepEqual(blue.variant, { key: "blue", label: "Blue" });
  assert.equal(product.variant, undefined);
  assert.equal(getCatalogVariant("pouncepop", "purple")?.label, "Purple");
  assert.equal(getCatalogVariant("pouncepop", "green"), undefined);
  assert.equal(getCatalogVariant("pouncepop", null), undefined, "a ball with no colour is never guessed");
});

test("product copy carries the owner's spec, with no fake urgency, reviews, 'was' prices, tax notes or size warnings", () => {
  for (const c of productContents) {
    const entry = getCatalogProduct(c.slug)!;
    const faqs = productFaqs(c, entry, c.database.price);
    const visible = [
      c.name, c.eyebrow, c.headline, c.subheadline, c.bundle.heading, c.bundle.intro, ...Object.values(c.bundle.tierNotes),
      // What the page template of 2026-11-15 shows: the buy box, the comparison, the diagram and the closing band
      c.tagline, c.description, ...c.features, c.trust.label, c.closing.heading, c.closing.cta, c.diagram?.caption ?? "",
      ...(c.transformation ? [c.transformation.eyebrow, c.transformation.heading, c.transformation.lede, c.transformation.before.alt, c.transformation.after.alt] : []),
      ...c.benefits.flatMap((b) => [b.title, b.text]),
      ...c.gallery.flatMap((g) => [g.alt, g.label, g.badge?.title ?? "", g.badge?.sub ?? ""]),
      ...c.demoLoops.flatMap((d) => [d.title, d.caption, d.posterAlt]),
      c.howItWorks.heading, c.howItWorks.tip ?? "", ...c.howItWorks.steps.flatMap((s) => [s.title, s.text]),
      c.comparison.heading, c.comparison.theirs, ...c.comparison.rows.flatMap((r) => [r.feature, r.ours, r.theirs]),
      c.included.heading, ...c.included.items, c.included.imageAlt,
      ...c.story.flatMap((s) => [s.heading, s.text, s.imageAlt]),
      ...faqs.flatMap((f) => [f.q, f.a]),
      c.seo.pageTitle, c.seo.description, c.seo.summary, ...c.seo.facts.flatMap((f) => [f.name, f.value]),
      c.merchant.title, c.merchant.description, ...c.merchant.highlights,
      c.database.name, c.database.shortDescription, c.database.description, c.database.details,
      entry.shortName,
    ].join(" \n ");

    // Numbers and claims the owner's spec doesn't give are not invented
    assert.doesNotMatch(visible, /\d+\s*(mAh|hours?\b|hrs?\b|minutes?\b|mins?\b|dB\b|decibels?)|waterproof|water[- ]resistant|IP[X0-9]{2}\b|non-toxic|BPA|certified|vet[- ](approved|recommended)/i);
    // Nothing a page may say whatever the product: invented proof, urgency or reference prices
    assert.doesNotMatch(visible, /bestsell|best[- ]sell|#1\b|only \d+ left|last units|limited (time|sale|stock)|sale ends|hurry|\d+% off|was \$|\d[\d,]*\+? (happy )?(customers|reviews|sold)|\d(\.\d)? ?(stars?|out of 5)/i);
    // No treatment promises (the roadmap's rule for every niche)
    assert.doesNotMatch(visible, /anxiety|stress relief|cures?\b|treats? (anxiety|stress|boredom)|therap/i);
    // Competitors are never named
    assert.doesNotMatch(visible, /calm ?tails|rolly|meow ?tumble|amazon|chewy/i);
    // The owner's rules of 2026-11-12: no tax or customs notes, no size or safety warnings
    assert.doesNotMatch(visible, /customs|\bVAT\b|dut(y|ies)|import tax|on delivery are|charged at the door/i);
    assert.doesNotMatch(visible, /golf|chok|swallow|not for (medium|large)|medium or large dogs|cats? only|supervis/i);
    // American English on the page
    assert.doesNotMatch(visible, /\bcolours?\b|\bfavourite\b|\bgrey\b/i);

    assert.ok(c.gallery.length >= 3 && c.gallery.length <= 5, "the gallery holds five images at most");
    assert.equal(new Set(c.gallery.map((g) => g.src)).size, c.gallery.length);
    assert.equal(c.benefits.length, 4);
    assert.equal(c.howItWorks.steps.length, 3);
    assert.ok(c.features.length >= 4 && c.features.length <= 6, "the buy box closes with a short list of features");
    assert.ok(c.tagline.length > 0 && c.description.length > 0 && c.description.length <= 140, "the buy box has a tagline and a short description");
    if (c.transformation) assert.notEqual(c.transformation.before.src, c.transformation.after.src, "the comparison shows two different photos");
    assert.ok(c.merchant.title.length <= 150);
    assert.ok(c.merchant.description.length >= 500 && c.merchant.description.length <= 5000);
    assert.ok(c.merchant.highlights.length >= 2 && c.merchant.highlights.length <= 10);
    for (const text of [c.merchant.title, c.merchant.description, ...c.merchant.highlights]) {
      assert.doesNotMatch(text, /\$|free shipping|\bsale\b|discount|% off|guarantee/i, "no price, shipping or promotional wording in listing copy");
    }
    assert.ok(c.seo.pageTitle.length <= 70);
    assert.ok(c.seo.description.length <= 160);
    assert.equal(c.demoLoops.every((d) => d.poster.length > 0), true, "a demo slot always has a still to show");
    // Google's rule: every marked-up fact is readable on the page (the specifications answer carries them)
    assert.ok(faqs.some((f) => f.q === "What are the specifications?"), "the page states its specifications in visible text");

    if (c.slug === "pouncepop") {
      // The owner's confirmed spec (2026-11-12), each point said somewhere on the page
      assert.match(c.name, /Dog & Cat/);
      assert.match(visible, /dogs? and cats?|dogs? & cats?/i);
      for (const claim of [/USB-C/, /obstacle/i, /revers|turns? (around|back)|bounces? (back|off)/i, /touch/i, /standby|sleep|rests?/i, /wakes?/i, /bounce/i, /roll/i, /LED/, /bite-resistant/i, /pet-safe/i]) {
        assert.match(visible, claim, `the page states ${claim}`);
      }
      const specs = faqs.find((f) => f.q === "What are the specifications?")!.a;
      for (const fact of [/USB-C/, /obstacle/i, /touch/i, /standby/i, /LED/, /bite-resistant/i, /42 mm/, /orange/i, /purple/i, /blue/i, /cable/i]) {
        assert.match(specs, fact, `the specifications answer states ${fact}`);
      }
      // In the box: the ball and its USB-C charging cable, nothing else
      assert.equal(c.included.items.length, 2);
      assert.match(c.included.items[0], /PouncePop/);
      assert.match(c.included.items[1], /USB-C charging cable/i);
      assert.equal(c.database.price, 29.99);
    }
  }
});

test("the product page's shipping and guarantee answers come from the catalog and the policy", () => {
  const faqs = productFaqs(content, ball, 29.99);
  const shipping = faqs.find((f) => f.q.startsWith("How fast is shipping"))!;
  for (const code of shipsTo("pouncepop")) assert.ok(shipping.a.includes(COUNTRY_RULES[code].name), `${code} is listed`);
  assert.match(shipping.a, /free and tracked/);
  assert.match(shipping.a, /United States 4–9 days/);
  assert.doesNotMatch(faqs.map((f) => `${f.q} ${f.a}`).join(" "), /customs|\bVAT\b|dut(y|ies)|import tax/i, "no tax or customs wording anywhere in the FAQ");
  const bundles = faqs.find((f) => f.q.startsWith("How do the bundle savings"))!;
  assert.match(bundles.a, /\$49\.99/);
  assert.match(bundles.a, /\$64\.99/);
  assert.match(bundles.a, /\$24\.98/);
  assert.doesNotMatch(productFaqs(content, ball).map((f) => f.a).join(" "), /\$\d/, "without a price the FAQ names no dollar amounts");
  assert.match(faqs.at(-1)!.q, /30-Day Money-Back Guarantee/);
  assert.match(faqs.at(-1)!.a, /within 30 days of delivery/);
});

test("product markup describes each colour as its own variant of one product", async () => {
  const { catalogProductSchema, faqSchema } = await import("../src/lib/seo/structured-data");
  const origin = new URL((await import("../src/config/site")).siteConfig.url).origin;
  const product = { id: "p1", slug: "pouncepop", name: content.database.name, sku: "PET-001", price: 29.99, stock: 20, shippingTax: 0, images: [] } as unknown as ProductDisplay;

  const schema = catalogProductSchema(product, ball, content) as Record<string, unknown>;
  assert.equal(schema["@type"], "ProductGroup");
  assert.equal(schema["@id"], `${origin}/products/pouncepop#product`);
  assert.equal(schema.productGroupID, "PET-001");
  assert.equal("aggregateRating" in schema, false, "no rating markup: the store shows no reviews");
  assert.equal("review" in schema, false);
  const variants = schema.hasVariant as { sku: string; color: string; offers: Record<string, unknown> }[];
  assert.deepEqual(variants.map((v) => v.sku), ["PET-001-OR", "PET-001-PU", "PET-001-BL"]);
  assert.deepEqual(variants.map((v) => v.color), ["Orange", "Purple", "Blue"]);
  for (const v of variants) {
    assert.equal(v.offers.price, "29.99");
    assert.equal(v.offers.priceCurrency, "USD");
    assert.equal("priceValidUntil" in v.offers, false);
    const destinations = (v.offers.shippingDetails as { shippingDestination: { addressCountry: string } }[]).map((d) => d.shippingDestination.addressCountry);
    assert.deepEqual(destinations, shipsTo("pouncepop"));
  }
  assert.doesNotMatch(JSON.stringify(schema), /compareAt|highPrice|strikethrough/i);
  assert.equal(faqSchema([{ q: "Q", a: "A" }], "/products/pouncepop")["@id"], `${origin}/products/pouncepop#faq`);
});

test("every product photo the page names is a file in public/", async () => {
  const { existsSync } = await import("node:fs");
  for (const c of productContents) {
    const entry = getCatalogProduct(c.slug)!;
    const paths = new Set([
      ...c.gallery.map((g) => g.src),
      ...c.demoLoops.map((d) => d.poster),
      ...c.story.map((s) => s.image),
      c.included.image,
      ...entry.variants.flatMap((v) => (v.image ? [v.image] : [])),
    ]);
    for (const path of paths) assert.ok(existsSync(`public${path}`), `${path} exists`);
  }
});

test("the delivery estimate counts business days from the store's own date", async () => {
  const { arrivalRange, storeToday } = await import("../src/lib/delivery-estimate");
  // Ordered on Sunday 15 November: processed in 1–2 business days, then 4–9 business days in transit
  assert.equal(arrivalRange("2026-11-15", { min: 4, max: 9 }), "Nov 20 – Nov 30");
  // Ordered on the Friday before: the weekend isn't counted, so the dates are the same
  assert.equal(arrivalRange("2026-11-13", { min: 4, max: 9 }), "Nov 20 – Nov 30");
  assert.equal(arrivalRange("2026-12-28", { min: 4, max: 7 }), "Jan 4 – Jan 8", "across the new year");
  assert.equal(arrivalRange("not a date", { min: 4, max: 9 }), null);
  // 03:30 UTC is still the evening before in the store's time zone
  assert.equal(storeToday(new Date("2026-11-15T03:30:00Z")), "2026-11-14");
});
