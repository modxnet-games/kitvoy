/**
 * The checkout's shape, shown the instant "Continue to checkout" is clicked
 * (route loading state) and while the saved cart loads in the browser, so the
 * page never sits blank.
 */
export function CheckoutSkeleton() {
  const bar = "rounded-xl bg-[#ebe8e1] motion-safe:animate-pulse";
  return (
    <div className="store-container checkout-page py-8 md:py-12" role="status" aria-label="Loading checkout">
      <div className="h-9 w-40 rounded-lg bg-[#ebe8e1] motion-safe:animate-pulse sm:h-10" />
      <div className={`mt-4 h-5 w-64 ${bar}`} />
      <div className="mt-8 grid gap-8 lg:grid-cols-12 lg:gap-10">
        <div className="space-y-5 rounded-2xl border border-[#e7e5df] bg-white p-6 sm:p-8 lg:col-span-7">
          <div className={`h-5 w-24 ${bar}`} />
          {[0, 1, 2].map((i) => <div key={i} className={`h-12 ${bar}`} />)}
          <div className={`mt-2 h-5 w-32 ${bar}`} />
          <div className="grid grid-cols-3 gap-4"><div className={`col-span-2 h-12 ${bar}`} /><div className={`h-12 ${bar}`} /></div>
          <div className="grid grid-cols-2 gap-4"><div className={`h-12 ${bar}`} /><div className={`h-12 ${bar}`} /></div>
          <div className="h-13 rounded-xl bg-[#c94b16]/25 motion-safe:animate-pulse" />
        </div>
        <div className={`hidden h-80 lg:col-span-5 lg:block ${bar}`} />
      </div>
      <span className="sr-only">Loading checkout…</span>
    </div>
  );
}
