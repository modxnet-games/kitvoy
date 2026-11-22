export default function OrderPrintLoading() {
  return (
    <div className="min-h-screen bg-white px-4 py-8">
      <div className="mx-auto max-w-xl rounded-lg border border-neutral-300 p-6">
        <h1 className="text-lg font-semibold">Preparing the delivery slip...</h1>
        <p className="mt-2 text-sm text-neutral-600">
          Loading the customer&apos;s address and the order&apos;s items.
        </p>
      </div>
    </div>
  );
}
