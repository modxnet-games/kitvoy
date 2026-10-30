"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";

/** Checks every open CJ order for a tracking number now (the server also does this on a schedule). */
export function CjSyncButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [, startRefresh] = useTransition();

  const sync = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/admin/fulfillment/cj-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage(typeof json?.error === "string" ? json.error : "CJ sync failed");
        return;
      }
      const parts = [`Checked ${json.checked} order${json.checked === 1 ? "" : "s"}`];
      if (json.shipped) parts.push(`${json.shipped} shipped (${json.emailed} emailed)`);
      if (json.delivered) parts.push(`${json.delivered} delivered`);
      if (json.errors?.length) parts.push(`${json.errors.length} need attention`);
      setMessage(parts.join(" · "));
      startRefresh(() => router.refresh());
    } catch {
      setMessage("Network error. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-start gap-1.5 sm:items-end">
      <button
        type="button"
        onClick={sync}
        disabled={busy}
        className="inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-4 text-sm font-semibold hover:bg-muted disabled:opacity-50"
      >
        {busy ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
        Sync CJ tracking
      </button>
      {message && <p className="text-xs text-muted-foreground" role="status">{message}</p>}
    </div>
  );
}
