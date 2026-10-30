"use client";

import { useState } from "react";
import { Lock, Loader2 } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import {
  US_STATES,
  validateCheckoutDetails,
  type CheckoutDetails,
  type CheckoutErrors,
} from "@/lib/us-address";
import { cn } from "@/lib/utils";
import { CheckoutField } from "./checkout-field";
import { CheckoutSection } from "./checkout-section";

export type CheckoutFormData = CheckoutDetails;

const EMPTY_FORM: CheckoutFormData = {
  email: "",
  fullName: "",
  phone: "",
  address1: "",
  address2: "",
  city: "",
  state: "",
  zip: "",
  // Payment happens on the next step with PayPal (PayPal account or guest card)
  paymentMethod: "paypal",
};

const ALL_TOUCHED = Object.fromEntries(
  Object.keys(EMPTY_FORM).map((k) => [k, true]),
) as Record<keyof CheckoutFormData, boolean>;

interface CheckoutFormProps {
  onSubmit: (data: CheckoutFormData) => void;
  isSubmitting?: boolean;
  /** Pre-fill when the customer goes back to edit their details */
  initialValues?: CheckoutFormData;
  submitLabel?: string;
}

export function CheckoutForm({ onSubmit, isSubmitting = false, initialValues, submitLabel }: CheckoutFormProps) {
  const { t } = useLanguage();
  const [values, setValues] = useState<CheckoutFormData>(initialValues ?? EMPTY_FORM);
  const [errors, setErrors] = useState<CheckoutErrors>({});
  const [touched, setTouched] = useState<Partial<Record<keyof CheckoutFormData, boolean>>>({});

  const setField = (field: keyof CheckoutFormData, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleChange = (field: keyof CheckoutFormData) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => setField(field, e.target.value);

  const handleBlur = (field: keyof CheckoutFormData) => () => {
    setTouched((prev) => ({ ...prev, [field]: true }));
    const fieldError = validateCheckoutDetails(values)[field];
    if (fieldError) {
      setErrors((prev) => ({ ...prev, [field]: fieldError }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    const formErrors = validateCheckoutDetails(values);
    setErrors(formErrors);
    setTouched(ALL_TOUCHED);

    if (Object.keys(formErrors).length === 0) {
      onSubmit(values);
    } else {
      document.getElementById(`checkout-${Object.keys(formErrors)[0]}`)?.focus();
    }
  };

  const showError = (field: keyof CheckoutFormData): string | undefined => {
    const key = touched[field] ? errors[field] : undefined;
    return key ? t(key) : undefined;
  };

  const fieldProps = (field: keyof CheckoutFormData) => ({
    id: `checkout-${field}`,
    value: values[field],
    onChange: handleChange(field),
    onBlur: handleBlur(field),
    error: showError(field),
    disabled: isSubmitting,
  });

  const stateError = showError("state");

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8" aria-busy={isSubmitting}>
      {Object.keys(errors).some(key => touched[key as keyof CheckoutFormData] && errors[key as keyof CheckoutFormData]) && <p role="alert" className="rounded-lg bg-destructive/5 p-3 text-sm text-destructive">Please check the highlighted fields before continuing.</p>}
      <CheckoutSection title={t("checkout.contactTitle")}>
        <CheckoutField
          {...fieldProps("email")}
          label={t("checkout.email")}
          type="email"
          inputMode="email"
          autoComplete="email"
          required
        />
      </CheckoutSection>

      <CheckoutSection title={t("checkout.shippingTitle")}>
        <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm">
          <span className="text-muted-foreground">{t("checkout.country")}: </span>
          <span className="font-medium">{t("checkout.countryValue")}</span>
        </div>
        <CheckoutField
          {...fieldProps("fullName")}
          label={t("checkout.fullName")}
          autoComplete="shipping name"
          required
        />
        <CheckoutField
          {...fieldProps("address1")}
          label={t("checkout.address1")}
          placeholder={t("checkout.address1Placeholder")}
          autoComplete="shipping address-line1"
          required
        />
        <CheckoutField
          {...fieldProps("address2")}
          label={t("checkout.address2")}
          autoComplete="shipping address-line2"
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <CheckoutField
            {...fieldProps("city")}
            label={t("checkout.city")}
            autoComplete="shipping address-level2"
            required
          />
          <div className="space-y-1.5">
            <label htmlFor="checkout-state" className="text-sm font-medium">
              {t("checkout.state")}
              <span className="text-destructive"> *</span>
            </label>
            <select
              id="checkout-state"
              name="state"
              required
              disabled={isSubmitting}
              value={values.state}
              onChange={handleChange("state")}
              onBlur={handleBlur("state")}
              autoComplete="shipping address-level1"
              aria-invalid={!!stateError}
              aria-describedby={stateError ? "checkout-state-error" : undefined}
              className={cn(
                "min-h-12 w-full rounded-lg border border-input bg-transparent px-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                stateError && "border-destructive",
                !values.state && "text-muted-foreground",
              )}
            >
              <option value="">{t("checkout.statePlaceholder")}</option>
              {US_STATES.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name}
                </option>
              ))}
            </select>
            {stateError && (
              <p id="checkout-state-error" className="text-xs text-destructive">
                {stateError}
              </p>
            )}
          </div>
          <CheckoutField
            {...fieldProps("zip")}
            label={t("checkout.zip")}
            inputMode="numeric"
            autoComplete="shipping postal-code"
            maxLength={10}
            required
          />
        </div>
        <CheckoutField
          {...fieldProps("phone")}
          label={t("checkout.phone")}
          type="tel"
          inputMode="tel"
          autoComplete="shipping tel"
          placeholder="(555) 555-0123"
          required
        />
      </CheckoutSection>

      <p className="flex items-start gap-2 rounded-xl bg-muted/60 p-3 text-xs text-muted-foreground">
        <Lock className="mt-0.5 size-3.5 shrink-0" />
        {t("checkout.paymentIntro")}
      </p>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting ? <span className="inline-flex items-center gap-2" role="status"><Loader2 className="size-4 animate-spin" />{t("checkout.processing")}</span> : (submitLabel ?? t("checkout.placeOrder"))}
      </button>
    </form>
  );
}
