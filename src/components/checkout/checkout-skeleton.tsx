const bar = "rounded-xl bg-[#ece6d8] motion-safe:animate-pulse";

/** A label, its input and (for some fields) the hint under it: the same heights as a real checkout field. */
function Field({ hint = false, className = "" }: { hint?: boolean; className?: string }) {
  return (
    <div className={className}>
      <div className={`h-5 w-24 ${bar}`} />
      <div className={`mt-1.5 h-12 ${bar}`} />
      {hint && <div className={`mt-1.5 h-4 w-52 max-w-full ${bar}`} />}
    </div>
  );
}

/** The details form's outline: contact, shipping address and the button. */
function DetailsShape() {
  return (
    <div className="space-y-8">
      <div>
        <div className={`h-6 w-20 ${bar}`} />
        <div className="mt-4 space-y-5">
          <Field hint />
          <Field />
          <Field hint />
        </div>
      </div>
      <div>
        <div className={`h-6 w-36 ${bar}`} />
        <div className={`mt-1 h-10 w-full ${bar} sm:h-5 sm:w-80`} />
        <div className="mt-4 space-y-5">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
            <Field className="sm:col-span-2" />
            <Field />
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-12 sm:gap-4">
            <Field className="sm:col-span-5" />
            <Field className="sm:col-span-4" />
            <Field className="sm:col-span-3" />
          </div>
        </div>
      </div>
      <div className="pt-1">
        <div className="h-13 rounded-xl bg-[#1c5244]/25 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

/**
 * The checkout's shape, shown the instant "Check out" is clicked
 * (route loading state) and while the saved cart loads in the browser. It
 * mirrors the real page section by section, so the page keeps its height and
 * nothing below it jumps when the real content arrives.
 */
export function CheckoutSkeleton({ label = "Loading checkout" }: { label?: string }) {
  return (
    <div className="store-container checkout-page py-8 md:py-12" role="status" aria-label={label}>
      <div className="h-9 w-40 rounded-lg bg-[#ece6d8] motion-safe:animate-pulse sm:h-10" />
      <div className={`mt-4 h-6 w-64 max-w-full ${bar}`} />
      <div className={`mt-6 h-[58px] rounded-2xl bg-[#ece6d8] motion-safe:animate-pulse lg:hidden`} />
      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-12 lg:items-start lg:gap-10">
        <div className="min-w-0 rounded-2xl border border-[#e6e0d2] bg-white p-5 sm:p-8 lg:col-span-7">
          <DetailsShape />
        </div>
        <div className={`hidden h-96 lg:col-span-5 lg:block ${bar}`} />
      </div>
      <div className="mt-8 h-11" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
