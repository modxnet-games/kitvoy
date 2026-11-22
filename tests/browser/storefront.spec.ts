import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

// These run against a local preview only (playwright.config.ts refuses any other host). No test places a real
// order: POST /api/orders is answered by the test itself, so nothing is saved and nobody is notified.
const LANGS = [
  { lang: "ar", dir: "rtl", order: /اطلبي الآن/, checkout: "إتمام الطلب", confirm: /تأكيد الطلب/, thanks: /شكراً/ },
  { lang: "fr", dir: "ltr", order: /Commander/, checkout: "Finaliser la commande", confirm: /Confirmer la commande/, thanks: /Merci/ },
] as const;

const TAGS = ["wcag2a", "wcag2aa", "wcag21aa"];

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

/** Answers the order request the way the server would, and records what the page sent. */
async function fakeOrders(page: Page) {
  const sent: Record<string, unknown>[] = [];
  await page.route("**/api/orders", async (route) => {
    sent.push(route.request().postDataJSON());
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ orderId: "test", orderReference: "CHR-TEST1234", totals: { subtotal: 350, shippingCost: 0, total: 350, savings: 48 } }) });
  });
  return sent;
}

for (const { lang, dir, order, checkout, confirm, thanks } of LANGS) {
  for (const width of [360, 390, 768, 1440]) {
    test(`${lang} at ${width}px: product page, sizes, cart, order form and thank-you`, async ({ page }) => {
      const sent = await fakeOrders(page);
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`/?lang=${lang}`);
      await expect(page.locator("html")).toHaveAttribute("lang", lang);
      await expect(page.locator("html")).toHaveAttribute("dir", dir);
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
      await noOverflow(page);

      // The 2-pack is the lead offer, and nothing can be ordered without a size
      await expect(page.locator(".kv-bundle").nth(1)).toHaveAttribute("aria-checked", "true");
      await page.locator("#buy-add").click();
      await expect(page.locator(".kv-size-error")).toBeVisible();
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // One size for the pack, then another size and colour for the second piece
      await page.locator(".kv-sizes .kv-size", { hasText: /^M$/ }).click();
      await expect(page.locator(".kv-size-error")).toHaveCount(0);
      await page.locator(".kv-size-select").nth(1).selectOption("L");
      await page.locator(".kv-colour-row").nth(1).locator(".kv-mood").nth(2).click();
      await expect(page.locator("#buy-add")).toHaveText(order);
      await page.locator("#buy-add").click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await expect(page.locator(".kv-cart-line")).toHaveCount(2);
      await expect(page.locator(".kv-cart-total")).toContainText("350");
      await noOverflow(page);

      await page.getByRole("link", { name: checkout }).click();
      await expect(page.locator(".kv-checkout-form")).toBeVisible();
      await expect(page.locator(".kv-checkout-total")).toContainText("350");

      // An empty form names every problem and sends nothing
      await page.locator(".kv-checkout-submit").click();
      await expect(page.locator(".kv-field-error")).toHaveCount(4);
      await expect(page.locator("#co-fullName")).toBeFocused();
      expect(sent).toHaveLength(0);

      await page.locator("#co-fullName").fill("Salma Bennani");
      await page.locator("#co-phone").fill("06 12 34 56 78");
      await page.locator("#co-city").selectOption("Casablanca");
      await page.locator("#co-address").fill("Maarif, rue 12, n° 5");
      await noOverflow(page);
      await expect(page.locator(".kv-checkout-submit")).toHaveText(confirm);
      await page.locator(".kv-checkout-submit").click();

      await expect(page).toHaveURL(/\/checkout\/success\?ref=CHR-TEST1234/);
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(thanks);
      await expect(page.locator(".kv-thanks-ref")).toContainText("CHR-TEST1234");
      await noOverflow(page);

      // What the page sent: the details, the language, and ids with colour and size (never a price)
      expect(sent).toHaveLength(1);
      expect(sent[0]).toMatchObject({ fullName: "Salma Bennani", phone: "06 12 34 56 78", city: "Casablanca", locale: lang, website: "" });
      const items = sent[0].items as { productId: string; quantity: number; variantKey: string }[];
      expect(items.map((i) => i.variantKey).sort()).toEqual(["black-m", "leopard-l"]);
      expect(Object.keys(items[0]).sort()).toEqual(["productId", "quantity", "variantKey"]);
      // The cart is empty afterwards
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("chrilik-cart") ?? "{}").state?.items?.length ?? 0)).toBe(0);
    });
  }
}

test("the language switch changes the page and is remembered", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lang=ar");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.locator(".kv-lang").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  expect(new URL(page.url()).search).toBe("");
  // A later visit without ?lang keeps French
  await page.goto("/shipping");
  await expect(page.locator("html")).toHaveAttribute("lang", "fr");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Livraison");
  await page.locator(".kv-lang").click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ar");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("التوصيل");
});

test("a server refusal is shown on the form and the cart is kept", async ({ page }) => {
  await page.route("**/api/orders", (route) => route.fulfill({ status: 429, contentType: "application/json", body: JSON.stringify({ error: "order.errorTooMany" }) }));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?lang=fr");
  await page.locator(".kv-sizes .kv-size", { hasText: /^S$/ }).click();
  await page.locator("#buy-add").click();
  await page.getByRole("link", { name: "Finaliser la commande" }).click();
  await page.locator("#co-fullName").fill("Salma Bennani");
  await page.locator("#co-phone").fill("0612345678");
  await page.locator("#co-city").selectOption("__other__");
  await page.getByPlaceholder("Nom de votre ville").fill("Tahla");
  await page.locator("#co-address").fill("Centre, rue principale 3");
  await page.locator(".kv-checkout-submit").click();
  await expect(page.locator(".kv-checkout-alert")).toContainText("Trop de commandes");
  await expect(page).toHaveURL(/\/checkout$/);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("chrilik-cart") ?? "{}").state?.items?.length ?? 0)).toBeGreaterThan(0);
});

test("old addresses lead to the store, and the dashboard stands apart from it", async ({ page }) => {
  for (const path of ["/products/pouncepop", "/inflator", "/products", "/login", "/account/orders", "/shop/anything"]) {
    await page.goto(path);
    expect(new URL(page.url()).pathname, path).toBe("/");
  }
  await page.goto("/admin/login");
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.locator(".kv-header")).toHaveCount(0);
  await expect(page.locator(".kv-footer")).toHaveCount(0);
});

test("reduced motion and automated accessibility, in both languages", async ({ page }) => {
  await fakeOrders(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const { lang, checkout } of LANGS) {
    await page.goto(`/?lang=${lang}`);
    expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
    expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations, `${lang} product page`).toEqual([]);
    await page.locator(".kv-sizes .kv-size", { hasText: /^M$/ }).click();
    await page.locator("#buy-add").click();
    await expect(page.getByRole("dialog")).toBeVisible();
    expect((await new AxeBuilder({ page }).include('[role="dialog"]').withTags(TAGS).analyze()).violations, `${lang} cart`).toEqual([]);
    await page.getByRole("link", { name: checkout }).click();
    await expect(page.locator(".kv-checkout-form")).toBeVisible();
    await page.locator(".kv-checkout-submit").click();
    await expect(page.locator(".kv-field-error")).toHaveCount(4);
    expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations, `${lang} order form with errors`).toEqual([]);
    for (const path of ["/returns", "/support"]) {
      await page.goto(path);
      expect((await new AxeBuilder({ page }).withTags(TAGS).analyze()).violations, `${lang} ${path}`).toEqual([]);
    }
    await page.evaluate(() => localStorage.clear());
  }
});
