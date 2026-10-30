import type { SentEmail } from "@prisma/client";

import { EmailComposer } from "@/components/admin/email-composer";
import { SentEmailList } from "@/components/admin/sent-email-list";
import { listSentEmails } from "@/lib/data/sent-emails";

export const dynamic = "force-dynamic";

export default async function AdminMessagesPage() {
  let emails: SentEmail[] = [];
  try {
    emails = await listSentEmails({ limit: 100 });
  } catch {
    // Table may not exist yet
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">Messages</h1>
        <p className="mt-1 text-muted-foreground">
          Email a customer from support@ or orders@kitvoy.com. Emails go out from the store server, so they send from any network.
        </p>
      </div>

      <section className="rounded-xl border bg-card p-6 shadow-sm" aria-labelledby="compose-heading">
        <h2 id="compose-heading" className="mb-4 font-semibold">New email</h2>
        <EmailComposer />
      </section>

      <section className="rounded-xl border bg-card p-6 shadow-sm" aria-labelledby="sent-heading">
        <h2 id="sent-heading" className="font-semibold">Sent emails</h2>
        <SentEmailList emails={emails} />
      </section>
    </div>
  );
}
