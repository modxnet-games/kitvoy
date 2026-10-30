"use client";

import { useState } from "react";
import { PayPalButtons, PayPalScriptProvider, usePayPalScriptReducer } from "@paypal/react-paypal-js";
import { Loader2, Lock } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";

interface PayPalPaymentProps {
  clientId: string;
  /** Store order created from the checkout details (amount lives server-side) */
  orderId: string;
  onPaid: () => void;
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

function Buttons({ orderId, onPaid, onError }: Omit<PayPalPaymentProps, "clientId"> & { onError: (key: string) => void }) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();
  const [capturing, setCapturing] = useState(false);

  if (isRejected) {
    return <p className="text-sm text-destructive">PayPal couldn’t load. Check your connection and refresh the page.</p>;
  }

  return (
    <div className="relative min-h-[150px]">
      {(isPending || capturing) && (
        <div className="absolute inset-0 z-10 flex items-center justify-center gap-2 rounded-xl bg-background/80 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {capturing ? "Confirming your payment…" : "Loading secure payment…"}
        </div>
      )}
      <PayPalButtons
        style={{ layout: "vertical", shape: "rect", label: "pay", height: 48 }}
        forceReRender={[orderId]}
        createOrder={async () => {
          const { id } = await callPayPalRoute("POST", orderId);
          return id as string;
        }}
        onApprove={async () => {
          setCapturing(true);
          try {
            await callPayPalRoute("PUT", orderId);
            onPaid();
          } catch (err) {
            setCapturing(false);
            onError(toMessageKey((err as Error).message));
          }
        }}
        onCancel={() => onError("checkout.paymentCanceled")}
        onError={(err) => {
          console.error("[paypal]", err);
          onError(toMessageKey(err instanceof Error ? err.message : ""));
        }}
      />
    </div>
  );
}

/** PayPal Smart Buttons: PayPal and guest debit/credit card. */
export function PayPalPayment({ clientId, orderId, onPaid }: PayPalPaymentProps) {
  const { t } = useLanguage();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="rounded-xl border border-destructive/20 bg-destructive/5 p-3 text-sm font-medium text-destructive">
          {t(error)}
        </div>
      )}
      <PayPalScriptProvider options={{ clientId, currency: "USD", intent: "capture", components: "buttons" }}>
        <Buttons orderId={orderId} onPaid={onPaid} onError={(key) => setError(key)} />
      </PayPalScriptProvider>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Lock className="size-3.5" />
        {t("checkout.secureNote")}
      </p>
    </div>
  );
}
