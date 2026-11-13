const bar = "rounded-xl bg-[#ebe8e1] motion-safe:animate-pulse";

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

/** The express block's outline: its label, one button and the "OR" before the form (the same heights as the real block). */
function ExpressShape() {
  return (
    <div className="mb-6" data-express-skeleton>
      <div className={`mx-auto h-4 w-28 ${bar}`} />
      <div className={`mt-3 h-13 ${bar}`} />
      <div className={`mx-auto mt-5 h-4 w-8 ${bar}`} />
    </div>
  );
}

/** The details form's outline: express checkout, contact, shipping address, the button and the sign-in shortcut. */
function DetailsShape() {
  return (
    <div>
      <ExpressShape />
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
        <div className="space-y-3 pt-1">
          <div className="h-13 rounded-xl bg-[#c94b16]/25 motion-safe:animate-pulse" />
          <div className={`mx-auto h-4 w-64 max-w-full ${bar}`} />
        </div>
      </div>
      <div className="mt-8 space-y-4">
        <div className={`mx-auto h-4 w-32 ${bar}`} />
        <div className={`h-12 ${bar}`} />
      </div>
    </div>
  );
}

/** The payment step's outline, for a checkout that is being restored: saved address, card form, pay button. */
function PaymentShape() {
  return (
    <div className="space-y-6 sm:space-y-8">
      <div className={`h-[66px] ${bar} sm:h-40`} />
      <div className="space-y-4 sm:space-y-5">
        <div>
          <div className={`h-7 w-28 ${bar}`} />
          <div className={`mt-1 h-4 w-64 max-w-full ${bar}`} />
        </div>
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`h-[52px] ${bar}`} />
          ))}
          <div className="h-[200px] sm:h-[340px]" />
        </div>
        <div className="h-13 rounded-xl bg-[#c94b16]/25 motion-safe:animate-pulse" />
      </div>
    </div>
  );
}

/**
 * The checkout's shape, shown the instant "Continue to checkout" is clicked
 * (route loading state), while the saved cart loads in the browser and while
 * a started checkout is being restored. It mirrors the real page section by
 * section, so the page keeps its height and nothing below it jumps when the
 * real content arrives.
 */
export function CheckoutSkeleton({ variant = "details", label = "Loading checkout" }: { variant?: "details" | "payment"; label?: string }) {
  return (
    <div className="store-container checkout-page py-8 md:py-12" role="status" aria-label={label}>
      <div className="h-9 w-40 rounded-lg bg-[#ebe8e1] motion-safe:animate-pulse sm:h-10" />
      <div className={`mt-4 h-6 w-64 max-w-full ${bar}`} />
      <div className={`mt-6 h-[58px] rounded-2xl bg-[#ebe8e1] motion-safe:animate-pulse lg:hidden`} />
      <div className="mt-6 grid gap-8 lg:mt-8 lg:grid-cols-12 lg:items-start lg:gap-10">
        <div className="min-w-0 rounded-2xl border border-[#e7e5df] bg-white p-5 sm:p-8 lg:col-span-7">
          {variant === "payment" ? <PaymentShape /> : <DetailsShape />}
        </div>
        <div className={`hidden h-96 lg:col-span-5 lg:block ${bar}`} />
      </div>
      <div className="mt-8 h-11" />
      <span className="sr-only">{label}…</span>
    </div>
  );
}
