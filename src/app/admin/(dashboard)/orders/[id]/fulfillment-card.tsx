"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { FulfillmentStatus } from "@prisma/client";
import { CheckCircle2, ExternalLink, Loader2, Mail, PackageCheck, Truck } from "lucide-react";

import { FulfillmentBadge } from "@/components/admin/fulfillment-badge";
import { Input } from "@/components/ui/input";
import { trackingUrl } from "@/lib/tracking";

interface FulfillmentCardProps {
  orderId: string;
  isPaid: boolean;
  isCanceled: boolean;
  fulfillmentStatus: FulfillmentStatus;
  trackingNumber: string | null;
  shippedAt: string | null;
}

/** Manual fulfillment: place the order in Zendrop, then record tracking here. */
export function FulfillmentCard({
  orderId,
  isPaid,
  isCanceled,
  fulfillmentStatus,
  trackingNumber,
  shippedAt,
}: FulfillmentCardProps) {
  const router = useRouter();
  const [tracking, setTracking] = useState(trackingNumber ?? "");
  const [error, setError] = useState<string | null>(null);
  const [emailNotice, setEmailNotice] = useState<{ sent: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState<FulfillmentStatus | "tracking" | null>(null);
  const [isRefreshing, startRefresh] = useTransition();

  const update = async (body: { fulfillmentStatus?: FulfillmentStatus; trackingNumber?: string }, action: typeof saving) => {
    setError(null);
    setEmailNotice(null);
    setSaving(action);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json?.error === "string" ? json.error : "Couldn’t update fulfillment");
        return;
      }
      const email = json?.customerEmail as { sent: boolean; reason?: string } | null | undefined;
      if (email) {
        setEmailNotice(
          email.sent
            ? { sent: true, text: "Shipping email sent to the customer." }
            : { sent: false, text: `Customer wasn’t emailed: ${email.reason ?? "unknown error"}` },
        );
      }
      startRefresh(() => router.refresh());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(null);
    }
  };

  const busy = saving !== null || isRefreshing;
  const trackingChanged = tracking.trim() !== (trackingNumber ?? "");

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Fulfillment</h2>
        <FulfillmentBadge status={fulfillmentStatus} />
      </div>

      {!isPaid || isCanceled ? (
        <p className="mt-4 rounded-lg bg-muted/60 p-3 text-sm text-muted-foreground">
          {isCanceled
            ? "This order is canceled, so there's nothing to ship."
            : "Waiting for payment. Fulfill this order once it shows as Paid."}
        </p>
      ) : (
        <div className="mt-4 space-y-4">
          {fulfillmentStatus === "UNFULFILLED" && (
            <p className="text-sm text-muted-foreground">
              Place this order in your Zendrop dashboard, then add the carrier tracking number here.
            </p>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (fulfillmentStatus === "UNFULFILLED") update({ fulfillmentStatus: "SHIPPED", trackingNumber: tracking }, "SHIPPED");
              else update({ trackingNumber: tracking }, "tracking");
            }}
            className="space-y-3"
          >
            <label htmlFor="tracking-number" className="text-sm font-medium">
              Tracking number
            </label>
            <Input
              id="tracking-number"
              value={tracking}
              onChange={(e) => setTracking(e.target.value)}
              placeholder="e.g. 9400 1112 0206 2187 4571 65"
              autoComplete="off"
              spellCheck={false}
              maxLength={64}
              disabled={busy || fulfillmentStatus === "DELIVERED"}
              className="h-10 font-mono"
            />

            {fulfillmentStatus === "UNFULFILLED" ? (
              <button
                type="submit"
                disabled={busy || !tracking.trim()}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
              >
                {saving === "SHIPPED" ? <Loader2 className="size-4 animate-spin" /> : <Truck className="size-4" />}
                Mark as shipped
              </button>
            ) : (
              fulfillmentStatus === "SHIPPED" && (
                <button
                  type="submit"
                  disabled={busy || !trackingChanged || !tracking.trim()}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50"
                >
                  {saving === "tracking" && <Loader2 className="size-4 animate-spin" />}
                  Update tracking number
                </button>
              )
            )}
          </form>

          {fulfillmentStatus === "SHIPPED" && (
            <button
              type="button"
              onClick={() => update({ fulfillmentStatus: "DELIVERED" }, "DELIVERED")}
              disabled={busy}
              className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
            >
              {saving === "DELIVERED" ? <Loader2 className="size-4 animate-spin" /> : <PackageCheck className="size-4" />}
              Mark as delivered
            </button>
          )}

          {fulfillmentStatus === "DELIVERED" && (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700">
              <CheckCircle2 className="size-4" />
              Delivered to the customer
            </p>
          )}

          {trackingNumber && fulfillmentStatus !== "UNFULFILLED" && (
            <a
              href={trackingUrl(trackingNumber)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
            >
              Track package
              <ExternalLink className="size-3.5" />
            </a>
          )}

          {shippedAt && (
            <p className="text-xs text-muted-foreground">
              Shipped {new Date(shippedAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          )}

          {fulfillmentStatus !== "UNFULFILLED" && (
            <button
              type="button"
              onClick={() => {
                if (window.confirm("Move this order back to Unfulfilled? The tracking number is kept.")) {
                  update({ fulfillmentStatus: "UNFULFILLED" }, "UNFULFILLED");
                }
              }}
              disabled={busy}
              className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
            >
              Undo: mark as unfulfilled
            </button>
          )}
        </div>
      )}

      {emailNotice && (
        <p
          className={
            emailNotice.sent
              ? "mt-4 flex items-start gap-2 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800"
              : "mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
          }
        >
          <Mail className="mt-0.5 size-4 shrink-0" />
          {emailNotice.text}
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
