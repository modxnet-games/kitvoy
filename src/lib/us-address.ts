/** US shipping address helpers shared by the checkout form and the orders API. */

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

export type PaymentMethod = "card" | "paypal";

export interface ShippingAddress {
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: "US";
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
  paymentMethod: PaymentMethod;
}

/** Field → i18n validation key */
export type CheckoutErrors = Partial<Record<keyof CheckoutDetails, string>>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ZIP_RE = /^\d{5}(-\d{4})?$/;

/** Returns i18n keys (e.g. "validation.zip") for every invalid field. */
export function validateCheckoutDetails(d: CheckoutDetails): CheckoutErrors {
  const errors: CheckoutErrors = {};
  if (!EMAIL_RE.test(d.email.trim())) errors.email = "validation.email";
  if (d.fullName.trim().length < 2) errors.fullName = "validation.fullName";

  // US numbers: 10 digits, optionally prefixed with country code 1
  const digits = d.phone.replace(/\D/g, "");
  if (!(digits.length === 10 || (digits.length === 11 && digits.startsWith("1")))) {
    errors.phone = "validation.phone";
  }

  if (d.address1.trim().length < 3) errors.address1 = "validation.address1";
  if (d.city.trim().length < 2) errors.city = "validation.city";
  if (!STATE_CODES.has(d.state)) errors.state = "validation.state";
  if (!ZIP_RE.test(d.zip.trim())) errors.zip = "validation.zip";
  return errors;
}

export function toShippingAddress(d: CheckoutDetails): ShippingAddress {
  return {
    address1: d.address1.trim(),
    address2: d.address2.trim(),
    city: d.city.trim(),
    state: d.state,
    zip: d.zip.trim(),
    country: "US",
  };
}

/**
 * One-line address stored in `Order.location` for the admin, emails and the
 * packing slip, which split it on commas: "street, city, STATE ZIP".
 */
export function formatAddressLine(a: ShippingAddress): string {
  const street = [a.address1, a.address2].filter(Boolean).join(" ");
  return `${street}, ${a.city}, ${a.state} ${a.zip}`;
}
