import Link from "next/link";
import type { SentEmail } from "@prisma/client";

import { formatOrderReference } from "@/lib/data/admin-orders";
import { formatDateTime } from "@/lib/formatters";

/** History of emails sent from the admin; each row expands to the message. */
export function SentEmailList({ emails, showOrder = true }: { emails: SentEmail[]; showOrder?: boolean }) {
  if (emails.length === 0) {
    return <p className="py-6 text-center text-sm text-muted-foreground">No emails sent yet.</p>;
  }
  return (
    <ul className="divide-y">
      {emails.map((email) => (
        <li key={email.id}>
          <details className="group py-3">
            <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{email.subject}</p>
                <p className="truncate text-xs text-muted-foreground">
                  To {email.toAddress} · from {email.fromAddress}
                  {showOrder && email.orderId && (
                    <>
                      {" · "}
                      <Link href={`/admin/orders/${email.orderId}`} className="underline underline-offset-2 hover:text-foreground">
                        {formatOrderReference(email.orderId)}
                      </Link>
                    </>
                  )}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span
                  className={
                    email.status === "sent"
                      ? "rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800"
                      : "rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800"
                  }
                >
                  {email.status === "sent" ? "Sent" : "Failed"}
                </span>
                <time className="text-xs text-muted-foreground" dateTime={email.createdAt.toISOString()}>
                  {formatDateTime(email.createdAt)}
                </time>
              </div>
            </summary>
            {email.error && <p className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-800">{email.error}</p>}
            <p className="mt-2 whitespace-pre-wrap rounded-md bg-muted/50 p-3 text-sm leading-relaxed">{email.body}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}
