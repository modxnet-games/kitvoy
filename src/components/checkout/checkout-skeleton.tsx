/**
 * The checkout's shape, shown the instant "Continue to checkout" is clicked
 * (route loading state) and while the saved cart loads in the browser, so the
 * page never sits blank.
 */
export function CheckoutSkeleton() {
  const bar = "rounded-lg bg-[#ebe8e1] motion-safe:animate-pulse";
  return (
    <div className="store-container checkout-page checkout-compact py-6 md:py-10" role="status" aria-label="Loading checkout">
      <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Checkout</h1>
      <div className={`mt-3 h-4 w-48 ${bar}`} />
      <div className="mt-5 grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 rounded-xl border bg-card p-5 lg:col-span-2">
          {[0, 1, 2].map((i) => <div key={i} className={`h-12 ${bar}`} />)}
          <div className="grid grid-cols-2 gap-3"><div className={`h-12 ${bar}`} /><div className={`h-12 ${bar}`} /></div>
          <div className="grid grid-cols-2 gap-3"><div className={`h-12 ${bar}`} /><div className={`h-12 ${bar}`} /></div>
          <div className="h-[52px] rounded-lg bg-[#c94b16]/30 motion-safe:animate-pulse" />
        </div>
        <div className={`hidden h-64 lg:block ${bar}`} />
      </div>
      <span className="sr-only">Loading checkout…</span>
    </div>
  );
}
