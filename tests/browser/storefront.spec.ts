import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// These are prepared for the local fixture, never a production store. No test
// submits valid order details.
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

test.beforeEach(async ({ page }) => {
  // Fail closed on order calls, whatever the local fixture is connected to.
  await page.route("**/api/orders", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "order.errorGeneric" }) }));
  await page.route("**/api/checkout/**", route => route.abort());
});

test("failed quote blocks checkout and can be retried", async ({ page }) => {
  let fail = true;
  await page.route("**/*", route => {
    // The quote comes from /api/cart/quote, with the older server action as its fallback: fail both
    const quote = new URL(route.request().url()).pathname === "/api/cart/quote";
    const action = route.request().method() === "POST" && !!route.request().headers()["next-action"];
    if (fail && (quote || action)) return route.abort();
    return route.continue();
  });
  await page.goto("/products/pouncepop");
  await page.getByRole("button", { name: "Add to cart · $49.99" }).click();
  await expect(page.getByText(/We couldn't check availability/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Check out" })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("link", { name: "Check out" })).toBeVisible();
});

test("the product page: one heading, gallery, bundles, a color for each ball, the cart and accessibility", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/products/pouncepop");
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "PouncePop Smart Interactive Dog & Cat Ball" })).toBeVisible();
  await noOverflow(page);
  // The 2-pack is the lead offer; a thumbnail changes the photo
  await expect(page.getByRole("radio", { name: /2 Balls/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByRole("button", { name: "Add to cart · $49.99" })).toBeEnabled();
  await page.getByRole("button", { name: /^Show image 2/ }).click();
  await expect(page.getByRole("button", { name: /^Show image 2/ })).toHaveAttribute("aria-current", "true");
  // Three balls: the chips under the price set one color for the whole pack, then the third ball gets its own
  await page.getByRole("radio", { name: /3 Balls/ }).click();
  await page.getByRole("radiogroup", { name: "Color for all 3 balls" }).getByRole("radio", { name: "Blue" }).click();
  await expect(page.getByRole("radiogroup", { name: "Color of ball 1" }).getByRole("radio", { name: "Blue" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radiogroup", { name: "Color of ball 3" }).getByRole("radio", { name: "Purple" }).click();
  await expect(page.getByRole("radiogroup", { name: "Color of ball 3" }).getByRole("radio", { name: "Purple" })).toHaveAttribute("aria-checked", "true");
  // Mixed again, so no single color stands for the pack
  await expect(page.getByRole("radiogroup", { name: "Color for all 3 balls" }).getByRole("radio", { name: "Blue" })).toHaveAttribute("aria-checked", "false");
  const product = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(product.violations).toEqual([]);
  await page.getByRole("button", { name: "Add to cart · $64.99" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  // The dot between the two is decoration, hidden from the heading's name
  await expect(page.getByRole("heading", { name: /^Cart +3 items$/ })).toBeVisible();
  // Two blue and one purple: one pack, two lines
  await expect(page.locator(".kv-cart-line")).toHaveCount(2);
  await expect(page.locator(".kv-cart-total")).toHaveText("$64.99 USD");
  await expect(page.getByRole("link", { name: "Check out" })).toBeVisible();
  const cart = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(cart.violations).toEqual([]);
  await noOverflow(page);
});
