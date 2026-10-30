import test from "node:test";
import assert from "node:assert/strict";
import { getLineTotal, getBundleSavings } from "../src/lib/bundles";
import { validateCheckoutDetails, toShippingAddress, type CheckoutDetails } from "../src/lib/us-address";
import { useCartStore, getShippingForItems } from "../src/store/cart-store";
import type { ProductDisplay } from "../src/types/product";

const product: ProductDisplay = { id: "unit-test", slug: "inflator", name: "Inflator", shortDescription: "", description: "", details: "", price: 59.99, shippingTax: 0, rating: 0, reviewCount: 0, stock: 9, sku: "TEST", isFeatured: false, category: { id: "test", slug: "test", name: "Test" }, images: [] };
const valid: CheckoutDetails = { email: "test@example.com", fullName: "Test Customer", phone: "2025550143", address1: "123 Test St", address2: "", city: "Washington", state: "DC", zip: "20001", paymentMethod: "paypal" };

test("shared pricing matches bundle totals and actual savings", () => {
  assert.deepEqual([1, 2, 3].map(q => getLineTotal(59.99, q)), [59.99, 101.98, 134.98]);
  assert.deepEqual([1, 2, 3].map(q => getBundleSavings(59.99, q)), [0, 18, 44.99]);
  assert.equal(getLineTotal(59.99, 4), 179.97);
  assert.equal(getLineTotal(63.27, 2), 107.56);
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
