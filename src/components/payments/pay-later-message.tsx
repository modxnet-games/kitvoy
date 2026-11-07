"use client";

import { useEffect, type ReactNode } from "react";
import {
  DISPATCH_ACTION,
  PayPalMessages,
  PayPalScriptProvider,
  SCRIPT_LOADING_STATE,
  usePayPalScriptReducer,
  type ReactPayPalScriptOptions,
} from "@paypal/react-paypal-js";

/**
 * One set of PayPal SDK options for every page, so the landing page and the
 * checkout share a single script instead of loading two that conflict.
 * Cards are taken by Stripe's form, so PayPal's own black "Debit or Credit
 * Card" button is turned off (disable-funding=card); Pay Later stays on.
 */
export function paypalScriptOptions(clientId: string): ReactPayPalScriptOptions {
  return { clientId, currency: "USD", intent: "capture", components: "buttons,messages", disableFunding: "card" };
}

/** Starts the deferred SDK download once the browser is idle, so it never delays the first paint. */
function LoadWhenIdle() {
  const [, dispatch] = usePayPalScriptReducer();
  useEffect(() => {
    const start = () => dispatch({ type: DISPATCH_ACTION.LOADING_STATUS, value: SCRIPT_LOADING_STATE.PENDING });
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(start, { timeout: 3000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(start, 1500);
    return () => clearTimeout(id);
  }, [dispatch]);
  return null;
}

/**
 * Wraps a page that shows Pay Later messages. Every message must sit under one
 * provider: a second provider reloads the SDK and destroys the first message.
 */
export function PayLaterProvider({ clientId, children }: { clientId: string | null; children: ReactNode }) {
  if (!clientId) return <>{children}</>;
  return (
    <PayPalScriptProvider options={paypalScriptOptions(clientId)} deferLoading>
      <LoadWhenIdle />
      {children}
    </PayPalScriptProvider>
  );
}

/**
 * PayPal's own Pay Later message ("Pay in 4 interest-free payments of …").
 * Only PayPal's component may word it, since it carries the required lending
 * disclosures, and it renders nothing when the buyer or amount isn't eligible.
 * Needs a PayLaterProvider above it.
 */
export function PayLaterMessage({ enabled, amount, align = "left", className = "" }: { enabled: boolean; amount: number | null; align?: "left" | "center"; className?: string }) {
  if (!enabled || amount == null) return null;
  return (
    <div className={`pay-later-message ${className}`}>
      <PayPalMessages
        amount={amount.toFixed(2)}
        currency="USD"
        placement="product"
        style={{ layout: "text", logo: { type: "inline" }, text: { color: "black", size: 12, align } }}
        // The SDK draws once; redraw when the chosen bundle changes the amount
        forceReRender={[amount, align]}
      />
    </div>
  );
}
