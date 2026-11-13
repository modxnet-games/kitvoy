"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { paypalScriptOptions } from "@/components/payments/pay-later-message";
import { canShipTo, type PayPalAddressReason } from "@/lib/checkout/express-details";
import { forgetExpressApproval, readExpressAnswer, readExpressApproval, rememberExpressApproval, type ExpressAnswer } from "@/lib/client/paypal-express";
import { cn } from "@/lib/utils";
import type { ProductDisplay } from "@/types/product";
import { CheckoutButton } from "./checkout-button";
import { checkoutInputClass } from "./checkout-field";
import type { ExpressHost, ExpressStatus } from "./express-checkout";

interface PayPalExpressProps {
  clientId: string;
  /** The cart: the server prices it again, the prices here are never used */
  items: { product: ProductDisplay; quantity: number }[];
  /** The cart as one string; the button is drawn again when it changes */
  cartKey: string;
  /** The session token of a checkout this browser already started, so that checkout keeps its one order */
  sessionToken: string | null;
  /** The countries every item in the cart ships to */
  countries: readonly string[];
  host: ExpressHost;
  /** Whether the button will show: while PayPal's script loads, once it has, or not at all */
  onStatus: (status: ExpressStatus) => void;
}

/** Height and corner radius of the wallet buttons above, so the two rows read as one block. */
const BUTTON_HEIGHT = 52;
const BUTTON_RADIUS = 12;
const ROUTE = "/api/checkout/paypal/express";
/** The route both express PayPal buttons talk to: the pop-up one here, the full-page one for Meta's in-app browsers. */
export const PAYPAL_EXPRESS_ROUTE = ROUTE;
/** A lost answer is asked for once more before the buyer is told anything: the call is safe to repeat. */
const RETRY_DELAY_MS = 1500;
/** How long PayPal's script may take before the space held for the button is given back. */
const LOAD_WAIT_MS = 10_000;

const REASON_KEYS: Record<PayPalAddressReason, string> = {
  country: "checkout.expressPaypalReasonCountry",
  state: "checkout.expressPaypalReasonState",
  postal: "checkout.expressPaypalReasonPostal",
  address: "checkout.expressPaypalReasonAddress",
};

type CartLines = PayPalExpressProps["items"];

/** The cart as the orders API reads it: ids and quantities matter, the rest is ignored by the server. */
export const cartPayload = (items: CartLines) =>
  items.map((i) => ({
    product: { id: i.product.id, slug: i.product.slug, name: i.product.name, price: i.product.price },
    quantity: i.quantity,
    variantKey: i.product.variant?.key,
  }));

/** Short codes for the checkout log: letters, digits and a few marks, never free text. */
export const logCode = (code: string) => code.replace(/[^A-Za-z0-9_.:,-]/g, "_").slice(0, 48);

/** Why a PayPal order couldn't be opened, as a message key: the server's own keys (with a dot) are shown as they are, its error codes get the general notice (null). */
export const createErrorKey = (error: string): string | null => (error === "EMPTY_CART" ? "order.errorEmptyCart" : error.includes(".") ? error : null);

/** One call to the server about an approved payment. `askedBefore`: this approval was already asked about, with no final answer. */
async function askToComplete(body: Record<string, unknown>, askedBefore: boolean): Promise<ExpressAnswer> {
  let res: Response;
  try {
    res = await fetch(ROUTE, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    return { status: "unconfirmed", code: "network" };
  }
  return readExpressAnswer(res.status, await res.json().catch(() => null), askedBefore);
}

/** Completes the approved payment on the server; when the outcome isn't known it is asked for a second time. */
async function completeOnServer(body: Record<string, unknown>, askedBefore: boolean): Promise<ExpressAnswer> {
  const first = await askToComplete(body, askedBefore);
  if (first.status !== "unconfirmed") return first;
  await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
  return askToComplete(body, true);
}

/** How one ask about an approval ended, for whoever started it: paid, still open (a phone number is owed), or closed without a payment. */
export type ExpressFinish = "paid" | "open" | "closed";

type CompletionInput = Pick<PayPalExpressProps, "items" | "cartKey" | "sessionToken" | "host"> & {
  /** Called when an approval ends without a payment and with nothing more to ask the buyer */
  onClosed?: () => void;
};

/**
 * What happens once the buyer has approved a PayPal order, whichever way they
 * got to PayPal (the pop-up button, or the whole page in Meta's in-app
 * browsers): the server completes it, and its answer becomes the confirmation
 * page, a request for a phone number, or a notice. Both buttons use this, so
 * every outcome is handled the same way.
 */
export function useExpressCompletion({ items, cartKey, sessionToken, host, onClosed }: CompletionInput) {
  const { t } = useLanguage();
  // The buyer approved and the server is completing the payment
  const [confirming, setConfirming] = useState(false);
  const confirmingRef = useRef(false);
  // The approved PayPal order that still needs a phone number before it can be completed
  const [phoneFor, setPhoneFor] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [phoneError, setPhoneError] = useState(false);
  const phoneInput = useRef<HTMLInputElement>(null);
  // An approval outlives the render it started in, so its steps read what is current from here
  const latest = useRef({ items, cartKey, sessionToken, host, t, onClosed });
  useEffect(() => {
    latest.current = { items, cartKey, sessionToken, host, t, onClosed };
  });

  useEffect(() => {
    if (phoneFor) phoneInput.current?.focus();
  }, [phoneFor]);

  const setBusy = (busy: boolean) => {
    confirmingRef.current = busy;
    setConfirming(busy);
  };

  /**
   * The buyer approved this PayPal order: have the server check it, save the order and take the payment.
   * `resumed`: the approval is one the page kept from before it was loaded, and the server is being asked again.
   */
  const finish = async (paypalOrderId: string, options: { phone?: string; resumed?: boolean } = {}): Promise<ExpressFinish> => {
    if (confirmingRef.current) return "open";
    const notCompleted = () => latest.current.host.notify(latest.current.t("checkout.expressPaypalNotCompleted"));
    if (!latest.current.host.acquire("paypal")) {
      // An approval from before the page loaded: what became of it isn't known, so nothing is said and it is kept
      if (options.resumed) return "open";
      // The form is saving or a wallet is paying: this approval isn't sent to the server now and is left to lapse, uncaptured
      if (readExpressApproval()?.id === paypalOrderId) forgetExpressApproval();
      latest.current.host.log("express_failed", { code: "paypal:locked" });
      notCompleted();
      return "closed";
    }
    setBusy(true);
    // Kept until the outcome is known, so a reload from here on, or an answer that never arrives, can ask the server again
    rememberExpressApproval(paypalOrderId, latest.current.cartKey);
    let paid = false;
    try {
      const answer = await completeOnServer(
        {
          paypalOrderId,
          items: cartPayload(latest.current.items),
          phone: options.phone,
          resumeToken: latest.current.sessionToken ?? undefined,
          // The page, without its query, for the server's Meta events
          tracking: { eventSourceUrl: `${window.location.origin}${window.location.pathname}` },
        },
        options.resumed === true,
      );
      const { host: now, t: say } = latest.current;
      // The approval is only kept while it is still open: its outcome unknown, or a phone number still owed
      if (answer.status !== "unconfirmed" && answer.status !== "needs_phone") forgetExpressApproval();
      switch (answer.status) {
        case "paid":
          paid = true;
          now.log("paypal_approved", { ref: answer.orderReference, code: "express" });
          now.paid({ orderReference: answer.orderReference, total: answer.total, contents: answer.contents });
          return "paid";
        case "needs_phone":
          // Asked for once; a number that was given and refused is marked
          setPhoneFor(paypalOrderId);
          setPhoneError(options.phone !== undefined);
          now.log("express_failed", { code: "paypal:needs_phone" });
          return "open";
        case "address_unusable":
          setPhoneFor(null);
          now.log("express_failed", { code: `paypal:address_${answer.reason}` });
          now.notify(say("checkout.expressPaypalAddress", { reason: say(REASON_KEYS[answer.reason]) }));
          return "closed";
        case "price_changed":
          setPhoneFor(null);
          now.log("express_failed", { code: "paypal:price_changed" });
          now.notify(say("checkout.expressPaypalTotalChanged"));
          return "closed";
        case "unconfirmed":
          // The server couldn't say, twice (or never answered): the payment may have gone through or may still, so nothing is claimed
          setPhoneFor(null);
          now.log("express_failed", { code: logCode(`paypal:unconfirmed:${answer.code}`) });
          now.notify(say("checkout.expressPaypalUnconfirmed"));
          return "closed";
        case "not_completed":
          // The server's own word that nothing was taken, and that nothing can be later
          setPhoneFor(null);
          now.log("express_failed", { code: logCode(`paypal:${answer.code}`) });
          notCompleted();
          return "closed";
      }
    } catch {
      if (paid) return "paid";
      setPhoneFor(null);
      latest.current.host.log("express_failed", { code: "paypal:exception" });
      latest.current.host.notify(latest.current.t("checkout.expressPaypalUnconfirmed"));
      return "closed";
    } finally {
      // A paid checkout keeps the lock until the confirmation page opens
      if (!paid) {
        setBusy(false);
        latest.current.host.release("paypal");
      }
    }
  };

  /** The same, for whoever only starts it: tells `onClosed` when the approval ended with nothing more to ask. */
  const run = async (paypalOrderId: string, options: { phone?: string; resumed?: boolean } = {}): Promise<ExpressFinish> => {
    const ended = await finish(paypalOrderId, options);
    if (ended === "closed") latest.current.onClosed?.();
    return ended;
  };

  const submitPhone = (event: FormEvent) => {
    event.preventDefault();
    const value = phone.trim();
    // The server applies the country's own rule; this only catches an empty or cut-off number
    if (value.replace(/\D/g, "").length < 7) {
      setPhoneError(true);
      phoneInput.current?.focus();
      return;
    }
    if (phoneFor) void run(phoneFor, { phone: value });
  };

  // Callbacks that outlive a render (PayPal's, a page event's) start an approval through here
  const finishRef = useRef(run);
  useEffect(() => {
    finishRef.current = run;
  });

  const phonePrompt = phoneFor ? (
    <form onSubmit={submitPhone} noValidate className="rounded-xl border border-[#e7e5df] bg-[#faf9f6] p-4" aria-busy={confirming} data-paypal-express-phone>
      <label htmlFor="express-paypal-phone" className="block text-sm font-medium leading-snug text-[#171918]">
        {t("checkout.expressPaypalPhone")}
      </label>
      <input
        ref={phoneInput}
        id="express-paypal-phone"
        name="phone"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        value={phone}
        onChange={(event) => {
          setPhone(event.target.value);
          setPhoneError(false);
        }}
        disabled={confirming}
        aria-invalid={phoneError || undefined}
        aria-describedby={phoneError ? "express-paypal-phone-message" : undefined}
        className={cn(checkoutInputClass, "mt-3")}
      />
      {phoneError && (
        <p id="express-paypal-phone-message" role="alert" className="mt-1.5 text-[13px] font-medium leading-snug text-[#b3261e]">
          {t("validation.phoneIntl")}
        </p>
      )}
      <CheckoutButton type="submit" className="mt-3" loading={confirming} loadingLabel={t("checkout.paymentChecking")}>
        {t("checkout.expressPaypalComplete")}
      </CheckoutButton>
    </form>
  ) : null;

  return {
    /** True while the server is completing an approval */
    confirming,
    confirmingRef,
    /** True while a phone number is owed for an approval; `phonePrompt` is then the form that asks for it */
    needsPhone: phoneFor !== null,
    phonePrompt,
    /** Asks the server to complete an approved PayPal order; always the current version, safe to call from a callback kept from an earlier render */
    finishRef,
  };
}

function ExpressButton({ items, cartKey, sessionToken, countries, host, onStatus }: Omit<PayPalExpressProps, "clientId">) {
  const { t } = useLanguage();
  const [{ isRejected, isResolved }] = usePayPalScriptReducer();
  const { confirming, confirmingRef, needsPhone, phonePrompt, finishRef } = useExpressCompletion({ items, cartKey, sessionToken, host });
  // The countries the server listed for the PayPal order that is open; the cart's own list until then
  const allowed = useRef<readonly string[] | null>(null);
  // Why the PayPal order couldn't be opened, when the server gave a message for it
  const createError = useRef<string | null>(null);
  // PayPal keeps the callbacks it was drawn with, so they read what is current from here
  const latest = useRef({ items, cartKey, sessionToken, countries, host, t });
  useEffect(() => {
    latest.current = { items, cartKey, sessionToken, countries, host, t };
  });

  // A script that neither loads nor fails must not hold the button's space forever; it still shows if it arrives late
  const [gaveUp, setGaveUp] = useState(false);
  const waiting = !isRejected && !isResolved;
  useEffect(() => {
    if (!waiting) return;
    const timer = setTimeout(() => setGaveUp(true), LOAD_WAIT_MS);
    return () => clearTimeout(timer);
  }, [waiting]);

  const status: ExpressStatus = isRejected ? "none" : isResolved ? "ready" : gaveUp ? "none" : "loading";
  useEffect(() => {
    onStatus(status);
  }, [status, onStatus]);
  useEffect(() => {
    if (isRejected) latest.current.host.log("express_failed", { code: "paypal:load" });
  }, [isRejected]);

  // An approval whose outcome this browser never learned (the page was reloaded while the payment was being
  // confirmed, or no answer arrived): the server is asked again as the button appears, so a paid order ends on
  // its confirmation page instead of a checkout that offers to pay again. Only for the cart it was approved for
  const askedAgain = useRef(false);
  useEffect(() => {
    if (askedAgain.current) return;
    askedAgain.current = true;
    const approval = readExpressApproval();
    if (approval && approval.cart === latest.current.cartKey) void finishRef.current(approval.id, { resumed: true });
  }, [finishRef]);

  if (isRejected) return null;

  return (
    <>
      {(status === "loading" || (confirming && !needsPhone)) && (
        <div
          className={cn(
            "absolute inset-x-0 top-0 z-10 flex h-13 items-center justify-center gap-2 rounded-xl text-sm font-medium text-[#666a67]",
            confirming ? "bg-white" : "pointer-events-none border border-[#eeece6] bg-[#f6f5f1] motion-safe:animate-pulse",
          )}
          role="status"
          aria-label={confirming ? undefined : t("checkout.expressLoading")}
        >
          {confirming && (
            <>
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              {t("checkout.paymentChecking")}
            </>
          )}
        </div>
      )}

      {/* PayPal's button stays in the page while it can't be used, so an approval in flight keeps its callbacks */}
      <div className={cn(needsPhone ? "hidden" : confirming && "invisible")} data-paypal-express>
        <PayPalButtons
          fundingSource="paypal"
          style={{ layout: "vertical", shape: "rect", label: "paypal", height: BUTTON_HEIGHT, borderRadius: BUTTON_RADIUS }}
          forceReRender={[cartKey]}
          onClick={(_data, actions) => {
            const { host: now } = latest.current;
            // A click while the form is saving or another payment runs must not open PayPal
            if (confirmingRef.current || now.isLocked()) return actions.reject();
            now.notify(null);
            // An earlier approval for this cart is still open (PayPal may be holding its payment): the server is
            // asked about that one again, and no second payment is opened beside it
            const earlier = readExpressApproval();
            if (earlier && earlier.cart === latest.current.cartKey) {
              now.log("express_clicked", { code: "paypal_recheck" });
              void finishRef.current(earlier.id, { resumed: true });
              return actions.reject();
            }
            now.log("express_clicked", { code: "paypal" });
            return actions.resolve();
          }}
          createOrder={async () => {
            createError.current = null;
            allowed.current = null;
            const res = await fetch(ROUTE, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ items: cartPayload(latest.current.items), resumeToken: latest.current.sessionToken ?? undefined }),
            });
            const json = (await res.json().catch(() => null)) as { paypalOrderId?: unknown; allowedCountries?: unknown; error?: unknown } | null;
            if (!res.ok || typeof json?.paypalOrderId !== "string") {
              const error = typeof json?.error === "string" ? json.error : "";
              createError.current = createErrorKey(error);
              throw new Error(error || "PAYMENT_INIT_FAILED");
            }
            if (Array.isArray(json.allowedCountries)) allowed.current = json.allowedCountries.filter((c): c is string => typeof c === "string");
            return json.paypalOrderId;
          }}
          onShippingAddressChange={async (data, actions) => {
            // PayPal shows the buyer their saved addresses. One the cart can't be shipped to is turned away while
            // they are still choosing; the server checks the full address again once they approve
            const address = data.shippingAddress;
            if (canShipTo({ country: address?.countryCode, state: address?.state }, allowed.current ?? latest.current.countries)) return;
            latest.current.host.log("express_failed", { code: "paypal:address_refused" });
            await actions.reject();
          }}
          onApprove={async (data) => {
            await finishRef.current(data.orderID);
          }}
          onCancel={() => {
            const { host: now, t: say } = latest.current;
            now.log("express_failed", { code: "paypal:canceled" });
            now.notify(say("checkout.expressPaypalNotCompleted"));
          }}
          onError={() => {
            // PayPal couldn't be opened, or its window failed: nothing was approved, so nothing can have been taken
            const { host: now, t: say } = latest.current;
            const key = createError.current;
            createError.current = null;
            now.log("express_failed", { code: logCode(key ? `paypal:create:${key}` : "paypal:error") });
            now.notify(say(key ?? "checkout.expressPaypalNotCompleted"));
          }}
        />
      </div>

      {phonePrompt}
    </>
  );
}

/**
 * PayPal at the top of the details step: one PayPal button (no card or Pay
 * Later button here) that opens PayPal in a pop-up. The buyer picks the
 * shipping address there; once they approve, the server reads it from PayPal,
 * saves the order and takes the payment in one call. No order exists before
 * that, and the browser never sees or sends the address.
 *
 * Not for Meta's in-app browsers, where the page behind a pop-up is lost:
 * there the express block shows PayPalExpressRedirect instead.
 */
export function PayPalExpress({ clientId, ...button }: PayPalExpressProps) {
  return (
    <PayPalScriptProvider options={paypalScriptOptions(clientId)}>
      <ExpressButton {...button} />
    </PayPalScriptProvider>
  );
}
