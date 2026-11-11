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

type Watch = { orderPosts: Request[]; metaRequests: string[]; events: { e: string; [key: string]: unknown }[]; eventBodies: string[] };

/** Counts order saves and catches any request to Meta. */
function watch(page: Page): Watch {
  const seen: Watch = { orderPosts: [], metaRequests: [], events: [], eventBodies: [] };
  page.on("request", (request) => {
    const url = request.url();
    if (request.method() === "POST" && new URL(url).pathname === "/api/orders") seen.orderPosts.push(request);
    if (/facebook\.com\/tr|connect\.facebook\.net|graph\.facebook\.com/.test(url)) seen.metaRequests.push(url);
    if (request.method() === "POST" && new URL(url).pathname === "/api/checkout/events") {
      const body = request.postData() ?? "";
      seen.eventBodies.push(body);
      try {
        seen.events.push(JSON.parse(body));
      } catch {
        // counted in eventBodies
      }
    }
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
  await expect.poll(() => seen.events.some((event) => event.e === "checkout_restored" && event.ref === order.orderReference)).toBe(true);
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
  // (both measured in the same frame: the page may still be scrolling the error into view)
  const gap = await page.evaluate(() => {
    const box = document.querySelector("[data-payment-error]")!.getBoundingClientRect();
    const button = [...document.querySelectorAll("button")].find((b) => /^Pay \$/.test((b.textContent ?? "").trim()))!.getBoundingClientRect();
    return button.top - box.bottom;
  });
  expect(gap).toBeGreaterThanOrEqual(0);
  expect(gap).toBeLessThan(48);
  await expect(error).toBeFocused();
  // The button is usable again straight away
  await expect(pay).toBeEnabled();
  expect(seen.metaRequests).toEqual([]);

  // The checkout log got each step, tied to the order reference, and nothing that was typed into the form
  await expect.poll(() => seen.events.map((event) => event.e)).toEqual(expect.arrayContaining(["checkout_opened", "details_saved", "stripe_ready", "pay_clicked", "pay_validation_error"]));
  const failure = seen.events.find((event) => event.e === "pay_validation_error")!;
  expect(failure.ref).toMatch(/^KTV-[A-Z0-9]{8}$/);
  expect(failure.step).toBe(2);
  expect(String(failure.code)).toMatch(/^[a-z_]+$/);
  for (const body of seen.eventBodies) {
    for (const value of Object.values(details)) expect(body).not.toContain(value);
  }
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

/* ---------- Meta's in-app browsers and PayPal ---------- */

// These need PayPal switched on in the preview. Any value works, because no
// call ever reaches PayPal here: start it with
//   PAYPAL_CLIENT_ID=sb-local-dummy PAYPAL_CLIENT_SECRET=local-dummy
const LOCAL_PAYPAL_ID = "sb-local-dummy";
const FACEBOOK_ANDROID =
  "Mozilla/5.0 (Linux; Android 14; SM-A166U Build/UP1A.231005.007) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.6723.58 Mobile Safari/537.36 [FB_IAB/FB4A;FBAV/574.0.0.40.71;IABMV/1;]";

const CHROME_ANDROID = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";

test.describe("in Facebook's in-app browser", () => {
  test.use({ userAgent: FACEBOOK_ANDROID });

  test.beforeEach(async ({ page }) => {
    const html = await (await page.request.get("/checkout")).text();
    test.skip(!html.includes(LOCAL_PAYPAL_ID), "PayPal isn't switched on in the local preview");
  });

  test("PayPal is a full-page redirect, and coming back without paying restores the payment step", async ({ page }) => {
    const seen = watch(page);
    await addOneAndOpenCheckout(page);
    await fillDetails(page);
    const order = await continueToPayment(page);

    // No pop-up buttons here: their callback would be lost when the app reloads the page
    const redirect = page.locator("[data-paypal-redirect]");
    await expect(redirect).toBeVisible();
    await expect(page.locator('iframe[name^="__zoid__paypal"], .paypal-buttons')).toHaveCount(0);

    // PayPal itself is never called: the store's answer and PayPal's page are stand-ins
    let sent: { orderId?: string; redirect?: boolean; resumeToken?: string } = {};
    await page.route("**/api/checkout/paypal", async (route) => {
      sent = route.request().postDataJSON();
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({ id: "TESTPAYPALORDER01", approveUrl: "https://www.sandbox.paypal.com/checkoutnow?token=TESTPAYPALORDER01" }) });
    });
    await page.route("https://www.sandbox.paypal.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<title>PayPal stand-in</title><h1>PayPal stand-in</h1>" }));

    await redirect.click();
    await expect(page).toHaveURL("https://www.sandbox.paypal.com/checkoutnow?token=TESTPAYPALORDER01");
    expect(sent.orderId).toBe(order.orderId);
    expect(sent.redirect).toBe(true);
    expect(sent.resumeToken).toBe(order.resumeToken);

    // PayPal sends the customer back to /checkout with a short-lived link token (here: backing out)
    const link = (await (await page.request.post("/api/checkout/link", { data: {} })).json()) as { url: string };
    const back = new URL(link.url);
    expect(back.pathname).toBe("/checkout");
    expect(back.searchParams.get("r")).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(back.searchParams.get("r")).not.toBe(order.resumeToken);
    await page.goto(`/checkout?r=${back.searchParams.get("r")}&pp=cancel&token=TESTPAYPALORDER01`);

    await expect(page.locator("#payment-heading")).toBeVisible();
    await expect(page.locator("[aria-labelledby=ship-to-heading]")).toContainText(details.fullName);
    await expect(page.getByText("Payment was canceled")).toBeVisible();
    // The link token and PayPal's parameters are gone from the address bar
    await expect(page).toHaveURL(/\/checkout$/);
    expect(seen.orderPosts).toHaveLength(1);
    expect(seen.metaRequests).toEqual([]);
  });

  test("the open-in-browser link opens the same payment step in another browser, with nothing to retype", async ({ page, browser }) => {
    await addOneAndOpenCheckout(page);
    await fillDetails(page);
    const order = await continueToPayment(page);

    const [made] = await Promise.all([
      page.waitForResponse((r) => new URL(r.url()).pathname === "/api/checkout/link"),
      page.locator("[data-open-in-browser=link]").click(),
    ]);
    const url = new URL(((await made.json()) as { url: string }).url);
    // This Chrome can't launch an Android app link, so it follows the link's own fallback:
    // the same payment step, still in this browser, with the token gone from the address bar
    await expect(page.locator("#payment-heading")).toBeVisible();
    await expect(page).toHaveURL(/\/checkout$/);
    expect(url.pathname).toBe("/checkout");
    const linkToken = url.searchParams.get("r");
    expect(linkToken).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(linkToken).not.toBe(order.resumeToken);

    // A different browser: no cookies, no storage, no cart
    const other = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: CHROME_ANDROID });
    const otherPage = await other.newPage();
    const otherSeen = watch(otherPage);
    await otherPage.goto(`/checkout?r=${linkToken}`);
    await expect(otherPage.locator("#payment-heading")).toBeVisible();
    await expect(otherPage.locator("[aria-labelledby=ship-to-heading]")).toContainText(details.fullName);
    await expect(otherPage).toHaveURL(/\/checkout$/);
    // Its own session, the cart rebuilt from the order, and the ordinary PayPal buttons (not the redirect)
    const stored = JSON.parse((await storedCheckout(otherPage)) ?? "{}");
    expect(stored.orderReference).toBe(order.orderReference);
    expect(stored.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(stored.token).not.toBe(linkToken);
    expect(await otherPage.evaluate(() => JSON.parse(localStorage.getItem("kitvoy-cart") ?? "{}").state?.items?.length)).toBe(1);
    await expect(otherPage.locator("[data-paypal-redirect]")).toHaveCount(0);
    await expect(otherPage.locator("[data-open-in-browser]")).toHaveCount(0);
    expect(otherSeen.orderPosts).toHaveLength(0);
    await other.close();

    // A made-up link gives nothing away: the plain empty checkout
    const stranger = await browser.newContext({ viewport: { width: 390, height: 844 }, userAgent: CHROME_ANDROID });
    const strangerPage = await stranger.newPage();
    await strangerPage.goto(`/checkout?r=${"A".repeat(43)}`);
    await expect(strangerPage.getByText("Your cart is empty")).toBeVisible();
    await expect(strangerPage.getByText(details.fullName)).toHaveCount(0);
    await stranger.close();
  });
});
