/**
 * Shipping address helpers shared by the checkout form and the orders API.
 *
 * The store started US-only (hence the file name); it now ships selected
 * products to the countries in config/catalog.ts. Each country has its own
 * postal code, phone and region rules here. An address with no country is a US
 * address, which is what every order saved before 2026-11 holds.
 */
import { SHIPPING_COUNTRY_CODES, type CountryCode } from "@/config/catalog";

export type { CountryCode };

export const US_STATES: { code: string; name: string }[] = [
  { code: "AL", name: "Alabama" },
  { code: "AK", name: "Alaska" },
  { code: "AZ", name: "Arizona" },
  { code: "AR", name: "Arkansas" },
  { code: "CA", name: "California" },
  { code: "CO", name: "Colorado" },
  { code: "CT", name: "Connecticut" },
  { code: "DE", name: "Delaware" },
  { code: "DC", name: "District of Columbia" },
  { code: "FL", name: "Florida" },
  { code: "GA", name: "Georgia" },
  { code: "HI", name: "Hawaii" },
  { code: "ID", name: "Idaho" },
  { code: "IL", name: "Illinois" },
  { code: "IN", name: "Indiana" },
  { code: "IA", name: "Iowa" },
  { code: "KS", name: "Kansas" },
  { code: "KY", name: "Kentucky" },
  { code: "LA", name: "Louisiana" },
  { code: "ME", name: "Maine" },
  { code: "MD", name: "Maryland" },
  { code: "MA", name: "Massachusetts" },
  { code: "MI", name: "Michigan" },
  { code: "MN", name: "Minnesota" },
  { code: "MS", name: "Mississippi" },
  { code: "MO", name: "Missouri" },
  { code: "MT", name: "Montana" },
  { code: "NE", name: "Nebraska" },
  { code: "NV", name: "Nevada" },
  { code: "NH", name: "New Hampshire" },
  { code: "NJ", name: "New Jersey" },
  { code: "NM", name: "New Mexico" },
  { code: "NY", name: "New York" },
  { code: "NC", name: "North Carolina" },
  { code: "ND", name: "North Dakota" },
  { code: "OH", name: "Ohio" },
  { code: "OK", name: "Oklahoma" },
  { code: "OR", name: "Oregon" },
  { code: "PA", name: "Pennsylvania" },
  { code: "RI", name: "Rhode Island" },
  { code: "SC", name: "South Carolina" },
  { code: "SD", name: "South Dakota" },
  { code: "TN", name: "Tennessee" },
  { code: "TX", name: "Texas" },
  { code: "UT", name: "Utah" },
  { code: "VT", name: "Vermont" },
  { code: "VA", name: "Virginia" },
  { code: "WA", name: "Washington" },
  { code: "WV", name: "West Virginia" },
  { code: "WI", name: "Wisconsin" },
  { code: "WY", name: "Wyoming" },
];

const STATE_CODES = new Set(US_STATES.map((s) => s.code));

export interface CountryRules {
  code: CountryCode;
  name: string;
  /** What the region field is called there */
  regionLabel: string;
  /** "select": a US state from the list. "required" / "optional": free text */
  region: "select" | "required" | "optional";
  postalLabel: string;
  postalExample: string;
  postal: RegExp;
  /** Chile: many people don't know their postal code, and carriers deliver without it */
  postalOptional?: boolean;
  /** International dialling code, used when hashing the phone for Meta */
  dialCode: string;
}

export const COUNTRY_RULES: Record<CountryCode, CountryRules> = {
  US: { code: "US", name: "United States", regionLabel: "State", region: "select", postalLabel: "ZIP code", postalExample: "10001", postal: /^\d{5}(-\d{4})?$/, dialCode: "1" },
  GB: { code: "GB", name: "United Kingdom", regionLabel: "County", region: "optional", postalLabel: "Postcode", postalExample: "SW1A 1AA", postal: /^[A-Z]{1,2}\d[A-Z\d]? ?\d[A-Z]{2}$/i, dialCode: "44" },
  DE: { code: "DE", name: "Germany", regionLabel: "State", region: "optional", postalLabel: "Postal code", postalExample: "10115", postal: /^\d{5}$/, dialCode: "49" },
  FR: { code: "FR", name: "France", regionLabel: "Region", region: "optional", postalLabel: "Postal code", postalExample: "75001", postal: /^\d{5}$/, dialCode: "33" },
  NL: { code: "NL", name: "Netherlands", regionLabel: "Province", region: "optional", postalLabel: "Postal code", postalExample: "1012 AB", postal: /^\d{4} ?[A-Z]{2}$/i, dialCode: "31" },
  ES: { code: "ES", name: "Spain", regionLabel: "Province", region: "required", postalLabel: "Postal code", postalExample: "28001", postal: /^\d{5}$/, dialCode: "34" },
  MX: { code: "MX", name: "Mexico", regionLabel: "State", region: "required", postalLabel: "Postal code", postalExample: "06000", postal: /^\d{5}$/, dialCode: "52" },
  CL: { code: "CL", name: "Chile", regionLabel: "Region", region: "required", postalLabel: "Postal code", postalExample: "8320000", postal: /^\d{7}$/, postalOptional: true, dialCode: "56" },
};

export function isCountryCode(value: unknown): value is CountryCode {
  return typeof value === "string" && (SHIPPING_COUNTRY_CODES as readonly string[]).includes(value);
}

/** The country of a stored address; one saved before the store shipped abroad has none and is American. */
export function countryOf(address: { country?: unknown } | null | undefined): CountryCode {
  return isCountryCode(address?.country) ? address.country : "US";
}

export const countryName = (code: CountryCode) => COUNTRY_RULES[code].name;

export type PaymentMethod = "card" | "paypal";

export interface ShippingAddress {
  address1: string;
  address2: string;
  city: string;
  /** US: two-letter state code. Elsewhere: the region as typed, possibly empty */
  state: string;
  zip: string;
  country: CountryCode;
}

export interface CheckoutDetails {
  email: string;
  fullName: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  /** Left out by browsers that loaded the checkout before 2026-11: read as "US" */
  country?: CountryCode;
  paymentMethod: PaymentMethod;
}

/** Field → i18n validation key */
export type CheckoutErrors = Partial<Record<keyof CheckoutDetails, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Returns i18n keys (e.g. "validation.zip") for every invalid field. */
export function validateCheckoutDetails(d: CheckoutDetails): CheckoutErrors {
  const errors: CheckoutErrors = {};
  const country = d.country ?? "US";
  if (!isCountryCode(country)) {
    errors.country = "validation.country";
    return errors;
  }
  const rules = COUNTRY_RULES[country];
  const us = country === "US";

  if (!EMAIL_RE.test(d.email.trim())) errors.email = "validation.email";
  if (d.fullName.trim().length < 2) errors.fullName = "validation.fullName";

  const digits = d.phone.replace(/\D/g, "");
  if (us) {
    // US numbers: 10 digits, optionally prefixed with country code 1
    if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) errors.phone = "validation.phone";
  } else if (digits.length < 7 || digits.length > 15) {
    errors.phone = "validation.phoneIntl";
  }

  if (d.address1.trim().length < 3) errors.address1 = "validation.address1";
  if (d.city.trim().length < 2) errors.city = "validation.city";

  if (rules.region === "select") {
    if (!STATE_CODES.has(d.state)) errors.state = "validation.state";
  } else if (rules.region === "required" && d.state.trim().length < 2) {
    errors.state = "validation.region";
  }

  const zip = d.zip.trim();
  if (!(rules.postalOptional && zip === "") && !rules.postal.test(zip)) errors.zip = us ? "validation.zip" : "validation.postal";
  return errors;
}

export function toShippingAddress(d: CheckoutDetails): ShippingAddress {
  const country = isCountryCode(d.country) ? d.country : "US";
  return {
    address1: d.address1.trim(),
    address2: d.address2.trim(),
    city: d.city.trim(),
    state: country === "US" ? d.state : d.state.trim(),
    zip: country === "US" ? d.zip.trim() : d.zip.trim().toUpperCase(),
    country,
  };
}

/**
 * One-line address stored in `Order.location` for the admin, emails and the
 * packing slip, which split it on commas: "street, city, STATE ZIP", with the
 * country added when it isn't the United States.
 */
export function formatAddressLine(a: Pick<ShippingAddress, "address1" | "address2" | "city" | "state" | "zip"> & { country?: CountryCode }): string {
  const street = [a.address1, a.address2].filter(Boolean).join(" ");
  const region = [a.state, a.zip].filter(Boolean).join(" ");
  const line = `${street}, ${a.city}${region ? `, ${region}` : ""}`;
  const country = a.country ?? "US";
  return country === "US" ? line : `${line}, ${COUNTRY_RULES[country].name}`;
}
