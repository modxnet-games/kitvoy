import { test, expect, type Page, type Request } from "@playwright/test";

// Checkout on a phone, against the local preview only (playwright.config.ts
// refuses any other host). These tests save real orders in the local database
// and open PaymentIntents in Stripe's sandbox; they never confirm a payment,
// and they fail if anything is sent to Meta.
test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const details = {
  email: "checkout-test@example.com",
  fullName: "Checkout Tester",
  phone: "2025550143",
  address1: "123 Test St",
  city: "Washington",
  state: "DC",
  zip: "20001",
};

type Watch = { orderPosts: Request[]; metaRequests: string[] };

/** Counts order saves and catches any request to Meta. */
function watch(page: Page): Watch {
  const seen: Watch = { orderPosts: [], metaRequests: [] };
  page.on("request", (request) => {
    const url = request.url();
    if (request.method() === "POST" && new URL(url).pathname === "/api/orders") seen.orderPosts.push(request);
    if (/facebook\.com\/tr|connect\.facebook\.net|graph\.facebook\.com/.test(url)) seen.metaRequests.push(url);
  });
  return seen;
}

async function addOneAndOpenCheckout(page: Page) {
  await page.goto("/");
  await page.locator("label.bundle-option").filter({ has: page.locator('input[value="1"]') }).click();
  await page.getByRole("button", { name: /^Add 1 to cart/ }).click();
  await page.getByRole("link", { name: "Continue to checkout" }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.locator("#checkout-email")).toBeVisible();
}

async function fillDetails(page: Page, overrides: Partial<typeof details> = {}) {
  const values = { ...details, ...overrides };
  await page.locator("#checkout-email").fill(values.email);
  await page.locator("#checkout-fullName").fill(values.fullName);
  await page.locator("#checkout-phone").fill(values.phone);
  await page.locator("#checkout-address1").fill(values.address1);
  await page.locator("#checkout-city").fill(values.city);
  await page.locator("#checkout-state").selectOption(values.state);
  await page.locator("#checkout-zip").fill(values.zip);
}

/** Saves the details and waits for the payment step; returns the server's answer. */
async function continueToPayment(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse((r) => new URL(r.url()).pathname === "/api/orders" && r.request().method() === "POST"),
    page.getByRole("button", { name: "Continue to payment" }).click(),
  ]);
  expect(response.status()).toBe(200);
  await expect(page.locator("#payment-heading")).toBeVisible();
  return (await response.json()) as { orderId: string; orderReference: string; resumeToken: string; reused: boolean };
}

const storedCheckout = (page: Page) => page.evaluate(() => localStorage.getItem("kitvoy-checkout"));

/** The page is no wider than the phone's screen (a mobile browser would otherwise zoom out or scroll sideways). */
async function expectNoSidewaysScroll(page: Page) {
  const width = page.viewportSize()!.width;
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width);
}

test.beforeEach(async ({ page }) => {
  // Sandbox only: the card form must be running on a Stripe test key
  const html = await (await page.request.get("/checkout")).text();
  test.skip(!html.includes("pk_test_"), "The local preview isn't using Stripe test keys");
});

test("a reload on the payment step comes back to the payment step, on the same order", async ({ page }) => {
  const seen = watch(page);
  await addOneAndOpenCheckout(page);
  await fillDetails(page);
  const order = await continueToPayment(page);
  expect(order.reused).toBe(false);
  expect(order.orderReference).toMatch(/^KTV-[A-Z0-9]{8}$/);

  // Once the order exists the browser keeps its token and reference, and none of the typed details
  const stored = (await storedCheckout(page)) ?? "";
  expect(Object.keys(JSON.parse(stored)).sort()).toEqual(["orderReference", "savedAt", "token", "v"]);
  for (const value of Object.values(details)) expect(stored).not.toContain(value);

  await page.reload();
  await expect(page.locator("#payment-heading")).toBeVisible();
  await expect(page.locator("[aria-labelledby=ship-to-heading]")).toContainText(details.fullName);
  await expect(page.locator("#checkout-email")).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  expect(seen.orderPosts).toHaveLength(1);

  // Edit, change the address, continue: the same order is updated, not duplicated
  await page.getByRole("button", { name: "Edit" }).click();
  await expect(page.locator("#checkout-address1")).toHaveValue(details.address1);
  await page.locator("#checkout-address1").fill("456 Other Ave");
  const edited = await continueToPayment(page);
  expect(edited.reused).toBe(true);
  expect(edited.orderReference).toBe(order.orderReference);
  expect(edited.orderId).toBe(order.orderId);
  await expect(page.locator("[aria-labelledby=ship-to-heading]")).toContainText("456 Other Ave");
  expect(seen.metaRequests).toEqual([]);
});

test("the checkout survives a new browser session: storage wiped, or cookies wiped", async ({ page, context }) => {
  const seen = watch(page);
  await addOneAndOpenCheckout(page);
  await fillDetails(page);
  const order = await continueToPayment(page);

  // An in-app browser recreated its web view: session and local storage are gone, the cookie is still there
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });
  await page.reload();
  await expect(page.locator("#payment-heading")).toBeVisible();
  await expect(page.locator("[aria-labelledby=ship-to-heading]")).toContainText(details.fullName);
  // The cart was rebuilt from the order, and the token is back in local storage
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kitvoy-cart") ?? "{}").state?.items?.length)).toBe(1);
  expect(JSON.parse((await storedCheckout(page)) ?? "{}").orderReference).toBe(order.orderReference);

  // The other way round: cookies gone, local storage kept
  await context.clearCookies();
  await page.reload();
  await expect(page.locator("#payment-heading")).toBeVisible();
  await expect(page.locator("[aria-labelledby=ship-to-heading]")).toContainText(details.fullName);

  expect(seen.orderPosts).toHaveLength(1);
  expect(seen.metaRequests).toEqual([]);
});

test("what is typed survives a reload before the order exists", async ({ page }) => {
  await addOneAndOpenCheckout(page);
  await page.locator("#checkout-email").fill(details.email);
  await page.locator("#checkout-fullName").fill(details.fullName);
  await page.locator("#checkout-city").fill(details.city);
  // The draft is saved a moment after typing stops
  await expect.poll(async () => (await storedCheckout(page)) ?? "").toContain(details.city);

  await page.reload();
  await expect(page.locator("#checkout-email")).toHaveValue(details.email);
  await expect(page.locator("#checkout-fullName")).toHaveValue(details.fullName);
  await expect(page.locator("#checkout-city")).toHaveValue(details.city);
  await expect(page.locator("#payment-heading")).toHaveCount(0);
});

test("an incomplete card shows its error beside the Pay button, on screen", async ({ page }) => {
  const seen = watch(page);
  await addOneAndOpenCheckout(page);
  await fillDetails(page);
  await continueToPayment(page);

  const pay = page.getByRole("button", { name: /^Pay \$/ });
  await expect(pay).toBeEnabled({ timeout: 30_000 });
  await pay.scrollIntoViewIfNeeded();
  await pay.click();

  const error = page.locator("[data-payment-error]");
  await expect(error).toBeVisible();
  await expect(error).toContainText(/incomplete|required|invalid/i);
  await expect(error).toBeInViewport({ ratio: 1 });
  await expect(pay).toBeInViewport();
  // Directly above the button, not at the far end of the card form
  const [errorBox, payBox] = [await error.boundingBox(), await pay.boundingBox()];
  expect(errorBox && payBox).toBeTruthy();
  expect(payBox!.y - (errorBox!.y + errorBox!.height)).toBeGreaterThanOrEqual(0);
  expect(payBox!.y - (errorBox!.y + errorBox!.height)).toBeLessThan(48);
  await expect(error).toBeFocused();
  // The button is usable again straight away
  await expect(pay).toBeEnabled();
  expect(seen.metaRequests).toEqual([]);
});

test("on a phone the card form and Pay button sit high, and the page keeps its height while loading", async ({ page }) => {
  // The server-rendered outline, before any script runs
  const skeleton = await page.context().newPage();
  await skeleton.route("**/*.js", (route) => route.abort());
  await skeleton.goto("/checkout");
  const skeletonHeight = await skeleton.locator(".checkout-page").evaluate((el) => el.getBoundingClientRect().height);
  await skeleton.close();

  await addOneAndOpenCheckout(page);
  await expectNoSidewaysScroll(page);
  const formHeight = await page.locator(".checkout-page").evaluate((el) => el.getBoundingClientRect().height);
  expect(Math.abs(formHeight - skeletonHeight)).toBeLessThan(120);

  await fillDetails(page);
  await continueToPayment(page);
  const pay = page.getByRole("button", { name: /^Pay \$/ });
  await expect(pay).toBeEnabled({ timeout: 30_000 });

  // The saved address is one compact row, and it is what the screen opens on
  const shipTo = page.locator("[aria-labelledby=ship-to-heading]");
  expect((await shipTo.boundingBox())!.height).toBeLessThan(90);
  await expect(shipTo).toBeInViewport();
  await expect(page.locator("#payment-heading")).toBeInViewport();
  // From the saved address down to the Pay button is about one screen, not two
  const distance = (await pay.boundingBox())!.y - (await shipTo.boundingBox())!.y;
  expect(distance).toBeLessThan(860);
  await expectNoSidewaysScroll(page);
});

test("a sandbox test card pays, lands on the confirmation and leaves nothing of the checkout behind", async ({ page, context }) => {
  const seen = watch(page);
  await addOneAndOpenCheckout(page);
  await fillDetails(page);
  const order = await continueToPayment(page);

  const pay = page.getByRole("button", { name: /^Pay \$/ });
  await expect(pay).toBeEnabled({ timeout: 30_000 });
  // Stripe's published test card, typed into Stripe's own frame
  const card = page.frameLocator('iframe[title="Secure payment input frame"]').first();
  await card.locator('[name="number"]').fill("4242 4242 4242 4242");
  await card.locator('[name="expiry"]').fill("12 / 34");
  await card.locator('[name="cvc"]').fill("123");
  await pay.click();

  await expect(page).toHaveURL((url) => url.pathname === "/checkout/success" && url.searchParams.get("ref") === order.orderReference, { timeout: 30_000 });
  await expect(page.getByRole("heading", { name: "Order confirmed" })).toBeVisible();
  // Paid: no token, no reference, no cart and no checkout cookie stay in the browser
  await expect.poll(() => storedCheckout(page)).toBeNull();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("kitvoy-cart") ?? "{}").state?.items?.length ?? 0)).toBe(0);
  await expect.poll(async () => (await context.cookies()).filter((c) => c.name.startsWith("kv_co")).length).toBe(0);
  expect(seen.orderPosts).toHaveLength(1);
  expect(seen.metaRequests).toEqual([]);

  // Coming back to the checkout starts clean: no redirect to the old confirmation, no restored step
  await page.goto("/checkout");
  await expect(page.getByText("Your cart is empty")).toBeVisible();
});
