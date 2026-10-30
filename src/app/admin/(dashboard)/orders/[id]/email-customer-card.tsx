"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

import { EmailComposer } from "@/components/admin/email-composer";

/** Order quick action: opens the composer pre-filled for this order's customer. */
export function EmailCustomerCard({
  orderId,
  orderReference,
  customerEmail,
  children,
}: {
  orderId: string;
  orderReference: string;
  customerEmail: string | null;
  /** Previous emails for this order (rendered on the server) */
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border bg-card p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">Email customer</h2>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-semibold hover:bg-muted"
          >
            <Mail className="size-4" />
            Write email
          </button>
        )}
      </div>
      {!customerEmail && !open && (
        <p className="mt-3 text-sm text-muted-foreground">This order has no customer email. You can still write to another address.</p>
      )}
      {open && (
        <div className="mt-4">
          <EmailComposer
            defaultTo={customerEmail ?? ""}
            defaultSubject={`Regarding your Kitvoy order ${orderReference}`}
            orderId={orderId}
          />
          <button type="button" onClick={() => setOpen(false)} className="mt-3 text-xs text-muted-foreground underline-offset-2 hover:underline">
            Close
          </button>
        </div>
      )}
      <div className="mt-4 border-t pt-2">
        <p className="pt-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Previous emails</p>
        {children}
      </div>
    </div>
  );
}
