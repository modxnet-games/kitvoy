"use client";

import { useState } from "react";
import { Link2 } from "lucide-react";

import { createCheckoutLinkAction } from "./actions";

/**
 * For an unpaid order: makes a link that opens this order's payment step in
 * the customer's browser, with their details already filled in. Meant to be
 * pasted into an email to a customer whose checkout failed.
 */
export function CheckoutLinkCard({ orderId }: { orderId: string }) {
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState<{ url: string; expiresAt: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const create = async () => {
    setBusy(true);
    setError(null);
    setCopied(false);
    const result = await createCheckoutLinkAction(orderId).catch(() => ({ error: "Could not create the link. Try again." }));
    setBusy(false);
    if ("error" in result && result.error) {
      setError(result.error);
      return;
    }
    if ("url" in result) setLink({ url: result.url, expiresAt: result.expiresAt });
  };

  const copy = async () => {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
    } catch {
      // The link stays selectable in the box
    }
  };

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Checkout link</h2>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted disabled:opacity-60"
        >
          <Link2 className="size-4" aria-hidden="true" />
          {busy ? "Creating…" : link ? "Create a new link" : "Create link"}
        </button>
      </div>
      <p className="mt-2 text-sm text-muted-foreground">
        This order isn&apos;t paid. A checkout link opens its payment step in the customer&apos;s browser with their details filled in, so they only have to pay.
      </p>
      {error && <p role="alert" className="mt-3 text-sm font-medium text-destructive">{error}</p>}
      {link && (
        <div className="mt-4 space-y-2">
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link.url}
              aria-label="Checkout link"
              onFocus={(event) => event.currentTarget.select()}
              className="h-10 min-w-0 flex-1 rounded-lg border bg-background px-3 font-mono text-xs"
            />
            <button type="button" onClick={copy} className="inline-flex h-10 shrink-0 items-center rounded-lg border px-3 text-sm font-medium transition-colors hover:bg-muted">
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            Works until {new Date(link.expiresAt).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}. Anyone who has it can see this
            order&apos;s shipping details and pay for it, so send it only to the customer. It isn&apos;t shown again: create a new one if you need it later.
          </p>
        </div>
      )}
    </div>
  );
}
