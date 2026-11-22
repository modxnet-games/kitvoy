"use client";

import { useEffect } from "react";

/**
 * Shown in place of a dashboard page that failed to load (the database did
 * not answer, for instance). A failure is said as one: an empty list would
 * read as "no orders".
 */
export default function AdminDashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin] page failed:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-xl rounded-xl border border-destructive/30 bg-destructive/5 p-6">
      <h1 className="text-lg font-semibold text-destructive">This page could not be loaded</h1>
      <p className="mt-2 text-sm text-destructive/90">
        Nothing was changed. Check the connection and try again; if it keeps failing, the server or its database needs a look.
      </p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex h-10 items-center rounded-xl border border-destructive/40 px-4 text-sm font-semibold text-destructive transition-colors hover:bg-destructive/10"
      >
        Try again
      </button>
    </div>
  );
}
