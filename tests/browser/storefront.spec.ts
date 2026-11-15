import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { mkdir } from "node:fs/promises";

// These are prepared for the local fixture, never a production store. No test
// submits valid order details or invokes a payment provider.
const screenshotDir = "artifacts/screenshots";

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}
async function choose(page: Page, quantity: number) {
  await page.locator('label.bundle-option').filter({ has: page.locator('input[value="' + quantity + '"]') }).click();
}
async function add(page: Page, quantity: number) {
  await choose(page, quantity);
  await page.getByRole("button", { name: new RegExp("^Add " + quantity + " to cart") }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByRole("link", { name: "Check out" })).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  // Fail closed on payment/order calls even if a local operator adds credentials.
  await page.route("**/api/orders", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "order.errorGeneric" }) }));
  await page.route("**/api/checkout/**", route => route.abort());
  await page.goto("/inflator");
  // One h1, and it names the product as well as carrying the headline
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  await expect(page.getByRole("heading", { level: 1, name: "Cordless digital tire inflator Low tire pressure? Take care of it yourself." })).toBeVisible();
});

for (const width of [360, 390, 768, 1440]) {
  test("layout, gallery, bundle, cart and checkout at " + width + "px", async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mkdir(screenshotDir, { recursive: true });
    await expect(page.locator(".gallery-product")).toBeVisible();
    // Hiding the caret styles inputs before hydration and triggers a false hydration warning
    await page.screenshot({ path: screenshotDir + "/home-" + width + ".png", fullPage: true, caret: "initial" });
    await noOverflow(page);
    await page.getByRole("button", { name: "Show display & controls" }).click();
    await expect(page.getByRole("button", { name: "Show display & controls" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Next product image" }).click();
    await expect(page.getByRole("button", { name: "Show air hose" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Show the inflator" }).click();

    await page.locator("#hero-cta").click();
    await choose(page, 2);
    await expect(page.getByRole("button", { name: "Add 2 to cart · $99.99" })).toBeEnabled();
    await page.locator("#bundles").screenshot({ path: screenshotDir + "/bundles-" + width + ".png" });
    await add(page, 2);
    await expect(page.locator(".kv-cart-total")).toHaveText("$99.99 USD");
    await page.getByRole("button", { name: "Increase quantity" }).click();
    await expect(page.locator(".kv-cart-total")).toHaveText("$134.98 USD");
    await page.getByRole("button", { name: "Decrease quantity" }).click();
    await expect(page.locator(".kv-cart-total")).toHaveText("$99.99 USD");
    await page.screenshot({ path: screenshotDir + "/cart-" + width + ".png" });
    await noOverflow(page);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
    await expect(page.locator(".mobile-buy-bar")).toBeHidden();
    await page.getByRole("button", { name: /^Open cart/ }).click();
    await page.getByRole("link", { name: "Check out" }).click();
    await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
    await expect(page.locator(".mobile-buy-bar")).toHaveCount(0);
    await page.getByRole("button", { name: "Continue to payment" }).click();
    await expect(page.getByLabel("Email", { exact: false })).toBeFocused();
    await expect(page.getByText(/Please fix the 7 highlighted fields to continue\./)).toBeVisible();
    await expect(page.locator("input[aria-invalid=true]")).toHaveCount(6);
    await page.screenshot({ path: screenshotDir + "/checkout-" + width + ".png", fullPage: true });
    await noOverflow(page);
    // On phones the order summary is folded, so use the step line that every width shows
    await page.locator(".checkout-progress").getByRole("link", { name: "Cart" }).click();
    await page.getByRole("button", { name: /^Remove/ }).click();
    await expect(page.getByText("Your cart is empty.")).toBeVisible();
  });
}

test("mobile navigation, sticky bar and modal keyboard containment", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator(".mobile-buy-bar")).toHaveCount(0);
  await page.locator("#how").scrollIntoViewIfNeeded();
  await expect(page.locator(".mobile-buy-bar")).toBeVisible();
  await page.getByRole("button", { name: "Open menu", exact: true }).click();
  await expect(page.locator(".mobile-buy-bar")).toHaveCount(0);
  await page.getByRole("navigation", { name: "Mobile navigation" }).getByRole("link", { name: "Bundles", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeHidden();
  await add(page, 3);
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press("Tab");
    // Base UI wraps focus through a guard element outside the popup, so wait for it to settle
    await expect.poll(() => page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: "Add 3 to cart · $134.98" })).toBeFocused();
  await page.locator("#faq").scrollIntoViewIfNeeded();
  await page.getByText("How do the bundle savings work?", { exact: true }).click();
  await expect(page.getByText(/Two inflators cost \$99\.99 together/)).toBeVisible();
  await noOverflow(page);
});

test("reduced motion and automated accessibility", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
  expect(await page.locator("canvas").count()).toBe(0);
  const home = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(home.violations).toEqual([]);
  await add(page, 1);
  const cart = await new AxeBuilder({ page }).include('[role="dialog"]').withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(cart.violations).toEqual([]);
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
  await choose(page, 1);
  await page.getByRole("button", { name: "Add 1 to cart · $59.99" }).click();
  await expect(page.getByText(/We couldn't check availability/)).toBeVisible();
  await expect(page.getByRole("link", { name: "Check out" })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByRole("link", { name: "Check out" })).toBeVisible();
});

test("sign-in and checkout offer Continue with Google", async ({ page }) => {
  await page.goto("/login?error=google_denied&redirect=//evil.com");
  await expect(page.getByRole("alert").filter({ hasText: "Google sign-in was canceled" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", "/api/auth/google?redirect=%2Faccount");
  const login = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).analyze();
  expect(login.violations).toEqual([]);

  await page.goto("/inflator");
  await add(page, 1);
  await page.getByRole("link", { name: "Check out" }).click();
  await expect(page.getByRole("heading", { name: "Checkout", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute("href", "/api/auth/google?redirect=%2Fcheckout");
  await noOverflow(page);
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
