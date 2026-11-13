"use client";

import { useEffect, useRef, useState } from "react";
import { AlertCircle, ArrowRight, ChevronDown, Info } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import {
  COUNTRY_RULES,
  US_STATES,
  isCountryCode,
  validateCheckoutDetails,
  type CheckoutDetails,
  type CheckoutErrors,
  type CountryCode,
} from "@/lib/us-address";
import { cn } from "@/lib/utils";
import { CheckoutButton } from "./checkout-button";
import { CheckoutField, checkoutInputClass } from "./checkout-field";

export type CheckoutFormData = CheckoutDetails;

/** The text fields of the form (everything but the country and the payment method). */
type TextField = "email" | "fullName" | "phone" | "address1" | "address2" | "city" | "state" | "zip";

const EMPTY_FORM: CheckoutFormData = {
  email: "",
  fullName: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  country: "US",
  // Payment happens on the next step (Stripe or PayPal)
  paymentMethod: "paypal",
};

const FIELD_ORDER: (keyof CheckoutFormData)[] = ["email", "fullName", "phone", "country", "address1", "address2", "city", "state", "zip"];

const ALL_TOUCHED = Object.fromEntries(
  Object.keys(EMPTY_FORM).map((k) => [k, true]),
) as Record<keyof CheckoutFormData, boolean>;

/** (555) 555-0123 as the customer types; the validator only reads the digits. */
function formatUsPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  const hasCountryCode = digits.length === 11 && digits.startsWith("1");
  if (hasCountryCode) digits = digits.slice(1);
  digits = digits.slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

/** 12345 or 12345-6789; anything else typed is dropped. */
function formatUsZip(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 9);
  return digits.length > 5 ? `${digits.slice(0, 5)}-${digits.slice(5)}` : digits;
}

interface CheckoutFormProps {
  onSubmit: (data: CheckoutFormData) => void;
  /** Called with the current values whenever the customer changes a field */
  onDraftChange?: (data: CheckoutFormData) => void;
  isSubmitting?: boolean;
  /** Pre-fill: the signed-in customer's name and email, or their details when they go back to edit */
  initialValues?: Partial<CheckoutFormData>;
  submitLabel?: string;
  /** The countries every item in the cart ships to; the address can only be in one of them */
  countries?: CountryCode[];
  /** Where the visitor is browsing from (Cloudflare's CF-IPCountry), used to pre-select the country */
  visitorCountry?: string | null;
  /** Days in transit per country for this cart, shown under the address heading */
  deliveryDays?: Partial<Record<CountryCode, { min: number; max: number }>>;
}

export function CheckoutForm({
  onSubmit,
  onDraftChange,
  isSubmitting = false,
  initialValues,
  submitLabel,
  countries = ["US"],
  visitorCountry = null,
  deliveryDays,
}: CheckoutFormProps) {
  const { t } = useLanguage();
  const allowed = countries.length ? countries : (["US"] as CountryCode[]);
  const [values, setValues] = useState<CheckoutFormData>(() => {
    // A saved country wins, then where the visitor is, then the first country the cart ships to
    const wanted = [initialValues?.country, visitorCountry].find((c): c is CountryCode => isCountryCode(c) && allowed.includes(c));
    return { ...EMPTY_FORM, ...initialValues, country: wanted ?? allowed[0] };
  });
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof CheckoutFormData, boolean>>>({});
  const summaryRef = useRef<HTMLDivElement>(null);

  const country = values.country ?? "US";
  const rules = COUNTRY_RULES[country];
  const us = country === "US";
  // The visitor is browsing from a country this cart doesn't ship to: say so next to the list of those it does
  const unservedVisitorCountry = (() => {
    const code = visitorCountry?.toUpperCase();
    if (!code || !/^[A-Z]{2}$/.test(code) || code === "XX" || code === "T1") return null;
    if (isCountryCode(code) && allowed.includes(code)) return null;
    try {
      return new Intl.DisplayNames(["en"], { type: "region" }).of(code) ?? null;
    } catch {
      return null;
    }
  })();

  // The cart changed to items that don't ship to the chosen country: move to one they do ship to
  useEffect(() => {
    if (!allowed.includes(country)) setValues((prev) => ({ ...prev, country: allowed[0], state: "", zip: "" }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed.join(","), country]);

  // Report edits (not the initial values), so a reload can bring back what was typed
  const firstValues = useRef(values);
  useEffect(() => {
    if (values !== firstValues.current) onDraftChange?.(values);
  }, [values, onDraftChange]);

  const setField = (field: TextField, raw: string) => {
    const value = field === "phone" && us ? formatUsPhone(raw) : field === "zip" && us ? formatUsZip(raw) : raw;
    setValues((prev) => ({ ...prev, [field]: value }));
    // A field being corrected stops shouting straight away
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const setCountry = (next: string) => {
    if (!isCountryCode(next) || !allowed.includes(next)) return;
    // A state and postal code only mean something in the country they were typed for
    setValues((prev) => ({ ...prev, country: next, state: "", zip: "", phone: next === "US" ? formatUsPhone(prev.phone) : prev.phone }));
    setErrors((prev) => ({ ...prev, country: undefined, state: undefined, zip: undefined, phone: undefined }));
    setTouched((prev) => ({ ...prev, state: false, zip: false }));
  };

  const handleChange = (field: TextField) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setField(field, e.target.value);

  const handleBlur = (field: keyof CheckoutFormData) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const fieldError = validateCheckoutDetails(values)[field];
    setErrors((prev) => ({ ...prev, [field]: fieldError }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const formErrors = validateCheckoutDetails(values);
    setErrors(formErrors);
    setTouched(ALL_TOUCHED);

    if (Object.keys(formErrors).length === 0) {
      onSubmit(values);
      return;
    }
    // Take the customer to the first problem, in the order the fields appear
    const first = FIELD_ORDER.find((f) => formErrors[f]);
    const el = first ? document.getElementById(`checkout-${first}`) : null;
    el?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    el?.focus({ preventScroll: true });
  };

  const showError = (field: keyof CheckoutFormData): string | undefined => {
    const key = touched[field] ? errors[field] : undefined;
    return key ? t(key) : undefined;
  };

  const isValid = (field: TextField) => !!touched[field] && !errors[field] && values[field].trim() !== "";

  const fieldProps = (field: TextField) => ({
    id: `checkout-${field}`,
    value: values[field],
    onChange: handleChange(field),
    onBlur: handleBlur(field),
    error: showError(field),
    valid: isValid(field),
    disabled: isSubmitting,
  });

  const stateError = showError("state");
  const visibleErrors = FIELD_ORDER.filter((f) => touched[f] && errors[f]).length;
  const days = deliveryDays?.[country];
  const selectClass = cn(checkoutInputClass, "appearance-none pr-10");

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8" aria-busy={isSubmitting}>
      {visibleErrors > 0 && (
        <div
          ref={summaryRef}
          role="alert"
          className="flex items-start gap-3 rounded-xl border border-[#f1c7c0] bg-[#fdf3f1] px-4 py-3 text-sm text-[#8f2a1f]"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>{visibleErrors === 1 ? t("checkout.fixOneField") : t("checkout.fixFields", { count: visibleErrors })}</p>
        </div>
      )}

      <fieldset>
        <legend className="text-base font-semibold text-[#171918]">{t("checkout.contactTitle")}</legend>
        <div className="mt-4 space-y-5">
        <CheckoutField
          {...fieldProps("email")}
          label={t("checkout.email")}
          hint={t("checkout.emailHint")}
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          required
        />
        <CheckoutField
          {...fieldProps("fullName")}
          label={t("checkout.fullName")}
          autoComplete="shipping name"
          required
        />
        <CheckoutField
          {...fieldProps("phone")}
          label={t("checkout.phone")}
          hint={t("checkout.phoneHint")}
          type="tel"
          inputMode="tel"
          autoComplete="shipping tel"
          placeholder={us ? "(555) 555-0123" : `+${rules.dialCode}`}
          maxLength={us ? undefined : 20}
          required
        />
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-base font-semibold text-[#171918]">{t("checkout.shippingTitle")}</legend>
        <p className="mt-1 text-sm text-[#666a67]">
          {us
            ? t("checkout.shippingNote")
            : days
              ? t("checkout.shippingNoteIntl", { country: rules.name, min: days.min, max: days.max })
              : t("checkout.countryLocked", { country: rules.name })}
        </p>
        <div className="mt-4 space-y-5">
        {(allowed.length > 1 || !us) && (
          <div className="min-w-0">
            <label htmlFor="checkout-country" className="mb-1.5 block text-sm font-medium text-[#171918]">
              {t("checkout.country")}
            </label>
            <div className="relative">
              <select
                id="checkout-country"
                name="country"
                required
                disabled={isSubmitting || allowed.length < 2}
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                autoComplete="shipping country"
                className={selectClass}
              >
                {allowed.map((code) => (
                  <option key={code} value={code}>
                    {COUNTRY_RULES[code].name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#666a67]" aria-hidden="true" />
            </div>
            {unservedVisitorCountry && (
              <p className="mt-1.5 flex items-start gap-1.5 text-[13px] leading-snug text-[#666a67]">
                <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                {t("checkout.countryNotServed", { country: unservedVisitorCountry })}
              </p>
            )}
          </div>
        )}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3 sm:gap-4">
          <CheckoutField
            {...fieldProps("address1")}
            label={t("checkout.address1")}
            placeholder={us ? t("checkout.address1Placeholder") : undefined}
            autoComplete="shipping address-line1"
            required
            className="sm:col-span-2"
          />
          <CheckoutField
            {...fieldProps("address2")}
            label={t("checkout.address2")}
            autoComplete="shipping address-line2"
            optional
          />
        </div>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-12 sm:gap-4">
          <CheckoutField
            {...fieldProps("city")}
            label={t("checkout.city")}
            autoComplete="shipping address-level2"
            required
            className="sm:col-span-5"
          />
          {rules.region === "select" ? (
          <div className="min-w-0 sm:col-span-4">
            <label htmlFor="checkout-state" className="mb-1.5 block text-sm font-medium text-[#171918]">
              {t("checkout.state")}
            </label>
            <div className="relative">
              <select
                id="checkout-state"
                name="state"
                required
                disabled={isSubmitting}
                value={values.state}
                onChange={handleChange("state")}
                onBlur={handleBlur("state")}
                autoComplete="shipping address-level1"
                aria-invalid={stateError ? true : undefined}
                aria-describedby={stateError ? "checkout-state-message" : undefined}
                className={cn(selectClass, !values.state && "text-[#9a9d99]")}
              >
                <option value="">{t("checkout.statePlaceholder")}</option>
                {US_STATES.map((s) => (
                  <option key={s.code} value={s.code}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3.5 top-1/2 size-4 -translate-y-1/2 text-[#666a67]" aria-hidden="true" />
            </div>
            {stateError && (
              <p id="checkout-state-message" role="alert" className="mt-1.5 text-[13px] font-medium leading-snug text-[#b3261e]">
                {stateError}
              </p>
            )}
          </div>
          ) : (
          <CheckoutField
            {...fieldProps("state")}
            label={rules.regionLabel}
            autoComplete="shipping address-level1"
            required={rules.region === "required"}
            optional={rules.region === "optional"}
            maxLength={50}
            className="sm:col-span-4"
          />
          )}
          <CheckoutField
            {...fieldProps("zip")}
            label={us ? t("checkout.zip") : rules.postalLabel}
            inputMode={us || rules.postal.source.includes("A-Z") === false ? "numeric" : "text"}
            autoComplete="shipping postal-code"
            autoCapitalize="characters"
            placeholder={us ? undefined : rules.postalExample}
            maxLength={10}
            required={!rules.postalOptional}
            optional={!!rules.postalOptional}
            className="sm:col-span-3"
          />
        </div>
        </div>
      </fieldset>

      <div className="space-y-3 pt-1">
        <CheckoutButton type="submit" loading={isSubmitting} loadingLabel={t("checkout.savingDetails")}>
          {submitLabel ?? t("checkout.placeOrder")}
          <ArrowRight className="size-[18px]" aria-hidden="true" />
        </CheckoutButton>
        <p className="text-center text-xs leading-relaxed text-[#666a67]">{t("checkout.paymentIntro")}</p>
      </div>
    </form>
  );
}
