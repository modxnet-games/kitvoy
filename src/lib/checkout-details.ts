/**
 * What the cash-on-delivery form collects, and the rules it must pass. Shared
 * by the form (to show each problem beside its field) and by the server (which
 * never trusts the browser's check). No email: the store confirms by phone.
 */
import { isLocale, type Locale } from "@/lib/i18n";
import { parseMoroccanPhone, westernDigits } from "@/lib/morocco";

export interface CheckoutDetails {
  fullName: string;
  phone: string;
  city: string;
  address: string;
}

export type CheckoutField = keyof CheckoutDetails;
export const CHECKOUT_FIELDS: CheckoutField[] = ["fullName", "phone", "city", "address"];

export const EMPTY_DETAILS: CheckoutDetails = { fullName: "", phone: "", city: "", address: "" };

const clean = (value: unknown, max: number) => (typeof value === "string" ? westernDigits(value).replace(/\s+/g, " ").trim().slice(0, max) : "");

/** The details as typed, trimmed and capped; nothing is rejected here. */
export function readCheckoutDetails(input: unknown): CheckoutDetails {
  const body = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  return {
    fullName: clean(body.fullName, 80),
    phone: clean(body.phone, 30),
    city: clean(body.city, 60),
    address: clean(body.address, 200),
  };
}

/** Each field that fails, with the message key to show ("validation.phone"). An empty object means the details are fine. */
export function validateCheckoutDetails(details: CheckoutDetails): Partial<Record<CheckoutField, string>> {
  const errors: Partial<Record<CheckoutField, string>> = {};
  // A name is letters in any script; two characters is a real Arabic first name
  if (details.fullName.replace(/[^\p{L}]/gu, "").length < 3) errors.fullName = "validation.fullName";
  if (!parseMoroccanPhone(details.phone)) errors.phone = "validation.phone";
  if (details.city.replace(/[^\p{L}]/gu, "").length < 2) errors.city = "validation.city";
  if (details.address.replace(/[^\p{L}\p{N}]/gu, "").length < 5) errors.address = "validation.address";
  return errors;
}

export function readLocale(value: unknown, fallback: Locale): Locale {
  return isLocale(value) ? value : fallback;
}
