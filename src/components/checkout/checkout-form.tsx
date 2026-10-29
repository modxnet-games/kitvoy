"use client";

import { useState } from "react";
import { CreditCard, Lock, Wallet } from "lucide-react";

import { useLanguage } from "@/contexts/language-context";
import {
  US_STATES,
  validateCheckoutDetails,
  type CheckoutDetails,
  type CheckoutErrors,
  type PaymentMethod,
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
  paymentMethod: "card",
};

const ALL_TOUCHED = Object.fromEntries(
  Object.keys(EMPTY_FORM).map((k) => [k, true]),
) as Record<keyof CheckoutFormData, boolean>;

interface CheckoutFormProps {
  onSubmit: (data: CheckoutFormData) => void;
  isSubmitting?: boolean;
}

export function CheckoutForm({ onSubmit, isSubmitting = false }: CheckoutFormProps) {
  const { t } = useLanguage();
  const [values, setValues] = useState<CheckoutFormData>(EMPTY_FORM);
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
    const formErrors = validateCheckoutDetails(values);
    setErrors(formErrors);
    setTouched(ALL_TOUCHED);

    if (Object.keys(formErrors).length === 0) {
      onSubmit(values);
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
  });

  const stateError = showError("state");

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-8">
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
              value={values.state}
              onChange={handleChange("state")}
              onBlur={handleBlur("state")}
              autoComplete="shipping address-level1"
              aria-invalid={!!stateError}
              aria-describedby={stateError ? "checkout-state-error" : undefined}
              className={cn(
                "h-8 w-full rounded-lg border border-input bg-transparent px-2 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm",
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

      <CheckoutSection title={t("checkout.paymentTitle")}>
        <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
          <PaymentOption
            method="card"
            selected={values.paymentMethod}
            onSelect={(m) => setField("paymentMethod", m)}
            icon={<CreditCard className="size-5" />}
            title={t("checkout.payCard")}
            detail={t("checkout.payCardDetail")}
          />
          <PaymentOption
            method="paypal"
            selected={values.paymentMethod}
            onSelect={(m) => setField("paymentMethod", m)}
            icon={<Wallet className="size-5" />}
            title={t("checkout.payPaypal")}
            detail={t("checkout.payPaypalDetail")}
          />
        </div>
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3.5" />
          {t("checkout.secureNote")}
        </p>
      </CheckoutSection>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        {isSubmitting ? t("checkout.processing") : t("checkout.placeOrder")}
      </button>
    </form>
  );
}

interface PaymentOptionProps {
  method: PaymentMethod;
  selected: PaymentMethod;
  onSelect: (method: PaymentMethod) => void;
  icon: React.ReactNode;
  title: string;
  detail: string;
}

function PaymentOption({ method, selected, onSelect, icon, title, detail }: PaymentOptionProps) {
  const isSelected = method === selected;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={isSelected}
      onClick={() => onSelect(method)}
      className={cn(
        "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        isSelected ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted/50",
      )}
    >
      <span className={cn("mt-0.5", isSelected ? "text-primary" : "text-muted-foreground")}>
        {icon}
      </span>
      <span>
        <span className="block text-sm font-semibold">{title}</span>
        <span className="block text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  );
}
