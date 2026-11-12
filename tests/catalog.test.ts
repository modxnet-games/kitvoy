import assert from "node:assert/strict";
import test from "node:test";

import { catalog, countriesForCart, getCatalogProduct, getCatalogVariant, productPath, shipsTo } from "../src/config/catalog";
import { cjLogisticFor, cjVariantFor } from "../src/config/fulfillment";
import { getProductContent, productContents } from "../src/config/products";
import { getBundleSavings, getLineTotal, lineSavings, priceLines } from "../src/lib/bundles";
import { buildCjOrderPayload, type CjOrderInput } from "../src/lib/fulfillment/cj-order";
import { orderLinesKey, validateOrderInput } from "../src/lib/orders";
import { productFaqs } from "../src/lib/product-faq";
import { COUNTRY_RULES, countryOf, formatAddressLine, toShippingAddress, validateCheckoutDetails, type CheckoutDetails } from "../src/lib/us-address";
import { withVariant, type ProductDisplay } from "../src/types/product";

const ball = getCatalogProduct("pouncepop")!;
const content = getProductContent("pouncepop")!;

const usDetails: CheckoutDetails = {
  email: "buyer@example.com", fullName: "Test Buyer", phone: "(202) 555-0143", address1: "1600 Example Ave", address2: "",
  city: "Washington", state: "DC", zip: "20001", country: "US", paymentMethod: "card",
};

test("every catalog product has a page, a number, tiers that start at one unit and a CJ variant per colour", () => {
  assert.deepEqual(catalog.map((p) => p.path).sort(), ["/inflator", "/products/pouncepop"]);
  assert.equal(new Set(catalog.map((p) => p.hubNumber)).size, catalog.length, "bio-link numbers are unique");
  for (const product of catalog) {
    assert.equal(product.tiers[0].quantity, 1);
    assert.equal(product.tiers[0].discount, 0);
    assert.ok(product.variants.length >= 1);
    assert.equal(product.hasColourChoice, product.variants.length > 1);
    assert.equal(new Set(product.variants.map((v) => v.cj.vid)).size, product.variants.length, "each colour ships its own CJ variant");
    assert.equal(new Set(product.variants.map((v) => v.sku)).size, product.variants.length);
    assert.ok(shipsTo(product.slug).includes("US"));
  }
  assert.equal(productPath("pouncepop"), "/products/pouncepop");
  assert.equal(productPath("cordless-tire-inflator"), "/inflator");
  assert.equal(productPath("unknown"), "/products");
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
  // The inflator's rule is untouched, and remains the rule for a product outside the catalog
  assert.deepEqual([1, 2, 3].map((q) => getLineTotal(59.99, q, "cordless-tire-inflator")), [59.99, 99.99, 134.98]);
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
  const mixed = priceLines([line(1), { productId: "p2", slug: "cordless-tire-inflator", unitPrice: 59.99, quantity: 1 }]);
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
  assert.deepEqual(shipsTo("cordless-tire-inflator"), ["US"]);
  assert.deepEqual(shipsTo("pouncepop"), ["US", "GB", "DE", "FR", "NL", "ES", "MX", "CL"]);
  assert.deepEqual(countriesForCart(["pouncepop"]), ["US", "GB", "DE", "FR", "NL", "ES", "MX", "CL"]);
  assert.deepEqual(countriesForCart(["pouncepop", "cordless-tire-inflator"]), ["US"], "with the inflator in the cart, the order can only go to the US");
  assert.deepEqual(countriesForCart(["something-else"]), ["US"]);
});

test("CJ orders carry the colour's own variant, the country and that country's shipping line", () => {
  assert.equal(cjVariantFor("pouncepop", "blue")?.sku, "CJYD169305903CX");
  assert.equal(cjVariantFor("pouncepop", "orange")?.vid, "1629734538815483904");
  assert.equal(cjVariantFor("pouncepop", null), undefined, "a ball with no colour is never guessed");
  assert.equal(cjVariantFor("pouncepop", "green"), undefined);
  assert.equal(cjVariantFor("cordless-tire-inflator", null)?.sku, "CJYD218658003CX");
  assert.equal(getCatalogVariant("pouncepop", "purple")?.label, "Purple");

  const de = toShippingAddress({ ...usDetails, country: "DE", city: "Berlin", state: "", zip: "10115" });
  const order: CjOrderInput = {
    id: "cmorder1234567890abcdefgh", reference: "KTV-ABCDEFGH", customerName: "Test Buyer", email: "buyer@example.com", phone: "+49301234567", total: 64.99,
    shippingAddress: de,
    items: [
      { productSlug: "pouncepop", productName: "PouncePop (Blue)", quantity: 2, variantKey: "blue" },
      { productSlug: "pouncepop", productName: "PouncePop (Orange)", quantity: 1, variantKey: "orange" },
    ],
  };
  const built = buildCjOrderPayload(order, { payType: 2, sandbox: false });
  assert.ok(built.ok);
  assert.deepEqual(built.payload.products, [
    { vid: "2407290950431610500", quantity: 2 },
    { vid: "1629734538815483904", quantity: 1 },
  ]);
  assert.equal(built.payload.shippingCountryCode, "DE");
  assert.equal(built.payload.shippingCountry, "Germany");
  assert.equal(built.payload.shippingProvince, "Berlin", "with no region typed, the city stands in for CJ's required province");
  assert.equal(built.payload.logisticName, "CJPacket Eub Special Line");
  assert.equal(cjLogisticFor(["pouncepop"], "MX"), "CJPacket Latin America Sensitive");
  assert.equal(cjLogisticFor(["pouncepop", "cordless-tire-inflator"], "US"), "CJPacket Sensitive");

  // No colour on the line, or a country the product doesn't ship to: left for a person, never guessed
  const noColour = buildCjOrderPayload({ ...order, items: [{ productSlug: "pouncepop", productName: "PouncePop", quantity: 1 }] }, { payType: 2, sandbox: false });
  assert.equal(noColour.ok, false);
  const inflatorAbroad = buildCjOrderPayload({ ...order, items: [{ productSlug: "cordless-tire-inflator", productName: "Cordless Tire Inflator", quantity: 1 }] }, { payType: 2, sandbox: false });
  assert.equal(inflatorAbroad.ok, false);
  assert.match(inflatorAbroad.ok ? "" : inflatorAbroad.error, /doesn't ship to Germany/);
});

test("the cart and the saved order tell colours apart", () => {
  const product = { id: "p1", slug: "pouncepop", name: "PouncePop", sku: "PET-001", images: ["/a.webp", "/blue.webp"] } as ProductDisplay;
  const blue = withVariant(product, { key: "blue", label: "Blue", sku: "PET-001-BL", image: "/blue.webp" });
  assert.equal(blue.sku, "PET-001-BL", "the colour's SKU is what tracking and the feed use");
  assert.deepEqual(blue.images, ["/blue.webp", "/a.webp"], "the colour's photo leads the cart line");
  assert.deepEqual(blue.variant, { key: "blue", label: "Blue" });
  assert.equal(product.variant, undefined);
  assert.notEqual(
    orderLinesKey([{ productId: "p1", variantKey: "blue", quantity: 2, unitPrice: 29.99 }]),
    orderLinesKey([{ productId: "p1", variantKey: "orange", quantity: 2, unitPrice: 29.99 }]),
    "changing only the colour still updates the saved order",
  );
  assert.equal(orderLinesKey([{ productId: "p1", quantity: 1, unitPrice: 59.99 }]), "p1x1@5999", "orders without colours keep their key");
});

test("product copy states only supplier-verified facts, with no fake urgency, reviews or 'was' prices", () => {
  for (const c of productContents) {
    const entry = getCatalogProduct(c.slug)!;
    const faqs = productFaqs(c, entry, c.database.price);
    const visible = [
      c.name, c.eyebrow, c.headline, c.subheadline, c.fitNote, c.bundle.heading, c.bundle.intro, ...Object.values(c.bundle.tierNotes),
      ...c.benefits.flatMap((b) => [b.title, b.text]),
      ...c.gallery.flatMap((g) => [g.alt, g.label]),
      ...c.demoLoops.flatMap((d) => [d.title, d.caption, d.posterAlt]),
      c.howItWorks.heading, c.howItWorks.tip ?? "", ...c.howItWorks.steps.flatMap((s) => [s.title, s.text]),
      c.comparison.heading, ...c.comparison.rows.flatMap((r) => [r.feature, r.ours, r.theirs]),
      c.included.heading, ...c.included.items, ...c.included.notIncluded,
      ...c.story.flatMap((s) => [s.heading, s.text, s.imageAlt]),
      ...faqs.flatMap((f) => [f.q, f.a]),
      c.seo.pageTitle, c.seo.description, c.seo.summary, ...c.seo.facts.flatMap((f) => [f.name, f.value]),
      c.merchant.title, c.merchant.description, ...c.merchant.highlights,
      c.database.shortDescription, c.database.description, c.database.details,
    ].join(" \n ");

    // Not in the supplier's written listing, so not claimed
    assert.doesNotMatch(visible, /USB-C|Type-C|obstacle|washable|non-toxic|BPA|certified|motion[- ]activated|motion sensor|auto(matic)? (shut|standby|sleep)|\d+\s*(mAh|hours?\b|minutes? of play)/i);
    // Water is only ever mentioned to say what the product is not
    assert.doesNotMatch(visible.replace(/isn't rated as waterproof/g, ""), /waterproof|water[- ]resistant/i);
    // Nothing a page may not say whatever the product
    assert.doesNotMatch(visible, /money[- ]back|risk[- ]free|no questions asked|guarantee|bestsell|best[- ]sell|#1|only \d+ left|last units|limited (time|sale|stock)|sale ends|hurry|\d+% off today|was \$|\d[\d,]*\+? (happy )?(customers|reviews|sold)/i);
    // No medical or behavioural promises (the roadmap's rule for every niche)
    assert.doesNotMatch(visible, /anxiety|stress relief|calms?|cure|treat(s|ment)?\b|vet[- ]approved|vet[- ]recommended/i);
    // Competitors are never named or copied
    assert.doesNotMatch(visible, /calm ?tails|rolly|amazon|chewy/i);

    // The box holds what CJ's packing list says, and the page says so in words
    assert.ok(c.included.items.length >= 1);
    assert.doesNotMatch(c.included.items.join(" "), /cable|charger|manual|adapter/i, "nothing the packing list doesn't name");
    // Google's rule: every marked-up fact is readable on the page (the specifications answer carries them)
    const specs = faqs.find((f) => f.q === "What are the specifications?");
    assert.ok(specs, "the page states its specifications in visible text");
    assert.match(specs.a, /42 mm/);
    assert.match(specs.a, /USB/);

    // The pet-size limit is said where people decide to buy, and in the feed
    if (c.slug === "pouncepop") {
      for (const text of [c.fitNote, faqs[0].a, c.merchant.description, c.database.description]) {
        assert.match(text, /not .*medium or large dogs|don't give it to a medium or large dog/i);
      }
    }

    assert.ok(c.merchant.title.length <= 150);
    assert.ok(c.merchant.description.length >= 500 && c.merchant.description.length <= 5000);
    assert.ok(c.merchant.highlights.length >= 2 && c.merchant.highlights.length <= 10);
    for (const text of [c.merchant.title, c.merchant.description, ...c.merchant.highlights]) {
      assert.doesNotMatch(text, /\$|free shipping|\bsale\b|discount|% off/i, "no price, shipping or promotional wording in listing copy");
    }
    assert.ok(c.seo.pageTitle.length <= 70);
    assert.ok(c.seo.description.length <= 160);
    assert.equal(c.database.price, 29.99);
    assert.equal(c.demoLoops.every((d) => d.poster.length > 0), true, "a demo slot always has a still to show");
  }
});

test("the product page's shipping answer names every country it ships to and where it ships from", () => {
  const faqs = productFaqs(content, ball, 29.99);
  const shipping = faqs.find((f) => f.q.startsWith("Where does it ship from"))!;
  for (const code of shipsTo("pouncepop")) assert.ok(shipping.a.includes(COUNTRY_RULES[code].name), `${code} is listed`);
  assert.match(shipping.a, /partner warehouse overseas/);
  assert.match(shipping.a, /United States 4–9 days/);
  assert.ok(faqs.some((f) => /import taxes/i.test(f.q)), "import taxes are disclosed for orders outside the US");
  const bundles = faqs.find((f) => f.q.startsWith("How do the bundle savings"))!;
  assert.match(bundles.a, /\$49\.99/);
  assert.match(bundles.a, /\$64\.99/);
  assert.match(bundles.a, /\$24\.98/);
  assert.doesNotMatch(productFaqs(content, ball).map((f) => f.a).join(" "), /\$\d/, "without a price the FAQ names no dollar amounts");
  assert.match(faqs.at(-1)!.a, /30 days/);
});

test("product markup and feed items describe each colour as its own variant of one product", async () => {
  const { catalogProductSchema, faqSchema } = await import("../src/lib/seo/structured-data");
  const { catalogFeedItems, merchantFeed } = await import("../src/lib/seo/merchant-feed");
  const origin = new URL((await import("../src/config/site")).siteConfig.url).origin;
  const product = { id: "p1", slug: "pouncepop", name: content.database.name, sku: "PET-001", price: 29.99, stock: 20, shippingTax: 0, images: [] } as unknown as ProductDisplay;

  const schema = catalogProductSchema(product, ball, content) as Record<string, unknown>;
  assert.equal(schema["@type"], "ProductGroup");
  assert.equal(schema["@id"], `${origin}/products/pouncepop#product`);
  assert.equal(schema.productGroupID, "PET-001");
  assert.equal("aggregateRating" in schema, false, "no rating markup without approved reviews");
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
  const rated = catalogProductSchema(product, ball, content, { count: 2, average: 4.5, distribution: [1, 1, 0, 0, 0], reviews: [] }) as Record<string, unknown>;
  assert.ok("aggregateRating" in rated, "ratings appear once real reviews are approved");
  assert.equal(faqSchema([{ q: "Q", a: "A" }], "/products/pouncepop")["@id"], `${origin}/products/pouncepop#faq`);

  const items = catalogFeedItems({ sku: "PET-001", price: 29.99, stock: 20, shippingTax: 0, images: [] }, ball, content);
  assert.equal(items.length, 3);
  for (const [i, item] of items.entries()) {
    const variant = ball.variants[i];
    assert.ok(item.includes(`<g:id>${variant.sku}</g:id>`));
    assert.ok(item.includes("<g:item_group_id>PET-001</g:item_group_id>"));
    assert.ok(item.includes(`<g:color>${variant.label}</g:color>`));
    assert.ok(item.includes(`colour=${variant.key}`), "the listing lands with its colour picked");
    assert.ok(item.includes("<g:price>29.99 USD</g:price>"));
    assert.ok(item.includes("<g:identifier_exists>no</g:identifier_exists>"), "no invented GTIN or MPN");
    assert.equal(/<g:sale_price>/.test(item), false);
  }
  const feed = merchantFeed(null, items);
  assert.equal([...feed.matchAll(/<item>/g)].length, 3);
  assert.doesNotMatch(feed.replace(/&(amp|lt|gt|quot);/g, ""), /&/, "no bare ampersand");
  assert.equal(content.merchant.inFeed, false, "the product stays out of the live feed until the owner switches it on");
});
