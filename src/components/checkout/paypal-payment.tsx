"use client";

import { useState } from "react";
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { AlertCircle, Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import { paypalScriptOptions } from "@/components/payments/pay-later-message";

interface PayPalPaymentProps {
  clientId: string;
  /** Store order created from the checkout details (amount lives server-side) */
  orderId: string;
  onPaid: () => void;
  /** Lets the page lock the other payment option while PayPal confirms */
  onProcessingChange?: (processing: boolean) => void;
  /** Checkout log: what happened with PayPal, never who */
  onEvent?: (event: "paypal_clicked" | "paypal_approved" | "paypal_canceled" | "paypal_error") => void;
  /** True while a card payment runs, so a second payment can't start here */
  disabled?: boolean;
}

/** Server error codes (e.g. PAYMENT_NOT_COMPLETED) map to a generic message; message keys pass through. */
const toMessageKey = (code: string) => (code.includes(".") ? code : "checkout.paymentFailed");

async function callPayPalRoute(method: "POST" | "PUT", orderId: string) {
  const res = await fetch("/api/checkout/paypal", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ orderId }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(typeof json?.error === "string" ? json.error : "order.errorGeneric");
  return json;
}

function Buttons({ orderId, onPaid, onError, onProcessingChange, onEvent, disabled }: Omit<PayPalPaymentProps, "clientId"> & { onError: (key: string) => void }) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  const [capturing, setCapturing] = useState(false);
  const setBusy = (busy: boolean) => {
    setCapturing(busy);
    onProcessingChange?.(busy);
  };

  if (isRejected) {
    return <p className="text-sm text-destructive">PayPal couldn’t load. Check your connection and refresh the page.</p>;
  }

  // One yellow PayPal button (the card button is off), so reserve just its height
  return (
    <div className={disabled ? "relative min-h-13 opacity-50" : "relative min-h-13"} aria-disabled={disabled || undefined}>
      {(isPending || capturing) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-white/85 text-sm font-medium text-[#666a67]" role="status">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          {capturing ? "Confirming your payment…" : "Loading PayPal…"}
        </div>
      )}
      <PayPalButtons
        style={{ layout: "vertical", shape: "rect", label: "pay", height: 52 }}
        disabled={disabled}
        forceReRender={[orderId]}
        createOrder={async () => {
          onEvent?.("paypal_clicked");
          const { id } = await callPayPalRoute("POST", orderId);
          return id as string;
        }}
        onApprove={async () => {
          setBusy(true);
          try {
            await callPayPalRoute("PUT", orderId);
            onEvent?.("paypal_approved");
            onPaid();
          } catch (err) {
            setBusy(false);
            onError(toMessageKey((err as Error).message));
          }
        }}
        onCancel={() => {
          onEvent?.("paypal_canceled");
          onError("checkout.paymentCanceled");
        }}
        onError={(err) => {
          console.error("[paypal]", err);
          onEvent?.("paypal_error");
          onError(toMessageKey(err instanceof Error ? err.message : ""));
        }}
      />
    </div>
  );
}

/** PayPal Smart Buttons: PayPal (and Pay Later). Cards go through the Stripe form, so PayPal's card button is off. */
export function PayPalPayment({ clientId, orderId, onPaid, onProcessingChange, onEvent, disabled }: PayPalPaymentProps) {
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="flex items-start gap-3 rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3 text-sm font-medium text-[#8f2a1f]">
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{t(error)}</p>
        </div>
      )}
      <PayPalScriptProvider options={paypalScriptOptions(clientId)}>
        <Buttons orderId={orderId} onPaid={onPaid} onError={(key) => setError(key)} onProcessingChange={onProcessingChange} onEvent={onEvent} disabled={disabled} />
      </PayPalScriptProvider>
    </div>
  );
}
