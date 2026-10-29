"use client";

export default function OrderPrintError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-xl rounded-lg border border-destructive/30 bg-destructive/5 p-6">
        <h1 className="text-lg font-semibold text-destructive">
          Unable to load invoice
        </h1>
        <p className="mt-2 text-sm text-destructive/90">
          {error.message || "The invoice data could not be loaded."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-4 rounded-lg border border-destructive/40 px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
