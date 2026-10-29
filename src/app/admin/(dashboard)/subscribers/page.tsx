import { prisma } from "@/lib/db";

export default async function AdminSubscribersPage() {
  let subscribers: { id: string; email: string; source: string; createdAt: Date }[] = [];

  try {
    subscribers = await prisma.emailSubscriber.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    // Table may not exist yet
  }

  return (
    <div>
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
            Emails / Subscribers
          </h1>
          <p className="mt-1 text-muted-foreground">
            {subscribers.length} email{subscribers.length !== 1 ? "s" : ""} collected
          </p>
        </div>
        <SubscriberActions emails={subscribers.map((s) => s.email)} />
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        {subscribers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No subscribers yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Emails from newsletter sign-ups, registrations, and logins will appear here
            </p>
          </div>
        ) : (
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="admin-table-header">
                <th className="px-4 py-3.5">Email</th>
                <th className="px-4 py-3.5">Source</th>
                <th className="px-4 py-3.5">Date</th>
              </tr>
            </thead>
            <tbody>
              {subscribers.map((sub) => (
                <tr
                  key={sub.id}
                  className="border-b last:border-0 transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-3.5 font-medium">{sub.email}</td>
                  <td className="px-4 py-3.5">
                    <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                      {sub.source}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {new Date(sub.createdAt).toLocaleDateString("en-GB", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Client component for copy / export actions ── */
function SubscriberActions({ emails }: { emails: string[] }) {
  return <SubscriberActionsClient emails={emails} />;
}

import { SubscriberActionsClient } from "./subscriber-actions-client";
