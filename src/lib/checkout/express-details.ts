/**
 * Express checkout gets the buyer's details from somewhere other than the
 * store's own form: a wallet (Apple Pay, Google Pay) or PayPal. These helpers
 * turn what arrives into the same CheckoutDetails the form produces, so one
 * set of rules (validateCheckoutDetails) decides whether the order can ship.
 *
 * Plain functions with no React, Stripe, PayPal or Node imports: the browser,
 * the server and the tests all use them. They are a convenience, not a trust
 * boundary: the orders API validates everything again.
 */
import { toCents } from "@/lib/payments/money";
import { US_STATES, isCountryCode, validateCheckoutDetails, type CheckoutDetails, type CheckoutErrors, type PaymentMethod } from "@/lib/us-address";

const lettersOnly = (value: string) => value.toUpperCase().replace(/[^A-Z]/g, "");

const STATE_CODES = new Set(US_STATES.map((s) => s.code));
const STATE_BY_NAME = new Map(US_STATES.map((s) => [lettersOnly(s.name), s.code]));
// The capital is written many ways: "Washington DC", "Washington, D.C."
STATE_BY_NAME.set("WASHINGTONDC", "DC");

/**
 * A US state as its two-letter code, from a code or a full name in any case
 * and punctuation ("ca", "California", "D.C.", "US-NY"). Null for anything
 * that is not one of the 50 states or DC: territories and military mail
 * (PR, GU, VI, AA, AE, AP) are places the store does not ship to.
 */
export function normalizeUsState(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // "US-CA" is how ISO 3166-2 writes it
  const key = lettersOnly(raw.trim().replace(/^US[\s-]+/i, ""));
  if (key.length === 2) return STATE_CODES.has(key) ? key : null;
  return STATE_BY_NAME.get(key) ?? null;
}

const text = (value: unknown) => (typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "");

/**
 * A postal code the way the store's rules read it: a US ZIP as 12345 or
 * 12345-6789, anything else trimmed and in capitals. A value that isn't a
 * postal code is left as it is, for the validator to report.
 */
export function normalizePostalCode(country: string, raw: unknown): string {
  const value = text(raw);
  if (country !== "US") return value.toUpperCase();
  if (!/^[\d\s-]+$/.test(value)) return value;
  const digits = value.replace(/\D/g, "");
  if (digits.length === 5) return digits;
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return value;
}

/** The buyer's details as an express method hands them over, before the store's rules are applied. */
export interface ExpressContact {
  name?: unknown;
  email?: unknown;
  phone?: unknown;
  line1?: unknown;
  line2?: unknown;
  city?: unknown;
  /** State, province or region: a code or a name */
  region?: unknown;
  postalCode?: unknown;
  /** Two-letter country code */
  country?: unknown;
}

/**
 * The details in the form's own shape. A US state becomes its two-letter code
 * ("" when it isn't one the store ships to); other countries keep the region
 * as given.
 *
 * `country` is left out when the address is in a country the store does not
 * ship to at all, and the region and postal code go with it. The validator
 * reads a missing country as the United States, so these details must always
 * go through checkExpressDetails, never straight to validateCheckoutDetails.
 */
export function buildExpressDetails(contact: ExpressContact, paymentMethod: PaymentMethod): CheckoutDetails {
  const code = text(contact.country).toUpperCase();
  const country = isCountryCode(code) ? code : undefined;
  return {
    email: text(contact.email),
    fullName: text(contact.name),
    phone: text(contact.phone),
    address1: text(contact.line1),
    address2: text(contact.line2),
    city: text(contact.city),
    state: !country ? "" : country === "US" ? normalizeUsState(contact.region) ?? "" : text(contact.region),
    zip: country ? normalizePostalCode(country, contact.postalCode) : "",
    ...(country && { country }),
    paymentMethod,
  };
}

/** An address as Stripe's Express Checkout Element reports it. */
export interface WalletAddress {
  line1?: string | null;
  line2?: string | null;
  city?: string | null;
  state?: string | null;
  postal_code?: string | null;
  country?: string | null;
}

/** What a wallet shares once the buyer authorises: the confirm event's billing and shipping data. */
export interface WalletData {
  billingDetails?: { name?: string | null; email?: string | null; phone?: string | null; address?: WalletAddress | null } | null;
  shippingAddress?: { name?: string | null; address?: WalletAddress | null } | null;
}

/**
 * Checkout details from a wallet payment. The parcel goes to the shipping
 * name and address; email and phone are only ever on the billing side.
 */
export function detailsFromWallet(wallet: WalletData): CheckoutDetails {
  const billing = wallet.billingDetails ?? {};
  const shipping = wallet.shippingAddress ?? {};
  const address = shipping.address ?? {};
  return buildExpressDetails(
    {
      name: text(shipping.name) || billing.name,
      email: billing.email,
      phone: billing.phone,
      line1: address.line1,
      line2: address.line2,
      city: address.city,
      region: address.state,
      postalCode: address.postal_code,
      country: address.country,
    },
    "card",
  );
}

type PayPalName = { given_name?: string | null; surname?: string | null };
type PayPalPhone = { national_number?: string | null };

/** The parts of an approved PayPal order that say who is buying and where the parcel goes. */
export interface PayPalBuyer {
  payer?: { name?: PayPalName | null; email_address?: string | null; phone?: { phone_number?: PayPalPhone | null } | null } | null;
  /** The PayPal account that pays; it repeats the payer on newer orders */
  payment_source?: { paypal?: { name?: PayPalName | null; email_address?: string | null; phone_number?: PayPalPhone | null } | null } | null;
  purchase_units?:
    | ({
        shipping?: {
          name?: { full_name?: string | null } | null;
          phone_number?: PayPalPhone | null;
          address?: {
            address_line_1?: string | null;
            address_line_2?: string | null;
            /** State, province or region */
            admin_area_1?: string | null;
            /** City */
            admin_area_2?: string | null;
            postal_code?: string | null;
            country_code?: string | null;
          } | null;
        } | null;
      } | null)[]
    | null;
}

const payPalFullName = (name: PayPalName | null | undefined) => [text(name?.given_name), text(name?.surname)].filter(Boolean).join(" ");

/**
 * Checkout details from a PayPal order the buyer approved. The parcel goes to
 * the shipping name and address chosen in PayPal; the email is the PayPal
 * account's.
 *
 * PayPal shares a phone number only when the account is set to, so `phone` is
 * the number the buyer was asked for when it didn't. One they typed for this
 * order is used before PayPal's own.
 */
export function detailsFromPayPal(order: PayPalBuyer, phone?: unknown): CheckoutDetails {
  const payer = order.payer ?? {};
  const account = order.payment_source?.paypal ?? {};
  const shipping = order.purchase_units?.[0]?.shipping ?? {};
  const address = shipping.address ?? {};
  return buildExpressDetails(
    {
      name: text(shipping.name?.full_name) || payPalFullName(payer.name) || payPalFullName(account.name),
      email: text(payer.email_address) || account.email_address,
      phone:
        text(phone) ||
        text(shipping.phone_number?.national_number) ||
        text(payer.phone?.phone_number?.national_number) ||
        account.phone_number?.national_number,
      line1: address.address_line_1,
      line2: address.address_line_2,
      city: address.admin_area_2,
      region: address.admin_area_1,
      postalCode: address.postal_code,
      country: address.country_code,
    },
    "paypal",
  );
}

/**
 * Why express details can't be used as they are, most serious first: the
 * country, then the address ("state", "postal", "address"), then the name or
 * email ("contact"), and the phone last, since it is the one thing a buyer
 * can add without leaving the express flow.
 */
export type ExpressProblem = "country" | "state" | "postal" | "address" | "contact" | "phone";

/**
 * Applies the form's rules to express details for a cart that ships to
 * `allowedCountries`. `errors` holds every invalid field, as the form shows them.
 */
export function checkExpressDetails(details: CheckoutDetails, allowedCountries: readonly string[]): { problem: ExpressProblem | null; errors: CheckoutErrors } {
  if (!details.country || !allowedCountries.includes(details.country)) {
    return { problem: "country", errors: { country: "validation.country" } };
  }
  const errors = validateCheckoutDetails(details);
  const problem: ExpressProblem | null = errors.country
    ? "country"
    : errors.state
      ? "state"
      : errors.zip
        ? "postal"
        : errors.address1 || errors.city
          ? "address"
          : errors.email || errors.fullName
            ? "contact"
            : errors.phone
              ? "phone"
              : null;
  return { problem, errors };
}

/**
 * Whether the store can ship to the partial address an express sheet shows
 * while the buyer is still choosing (country and region only, no street yet).
 * A US state that hasn't been given yet passes: the full address is checked
 * once the buyer authorises.
 */
export function canShipTo(address: { country?: unknown; state?: unknown }, allowedCountries: readonly string[]): boolean {
  const country = text(address.country).toUpperCase();
  if (!isCountryCode(country) || !allowedCountries.includes(country)) return false;
  if (country !== "US") return true;
  return text(address.state) === "" || normalizeUsState(address.state) !== null;
}

/** What a wallet sheet is told when the details can't be used, so it points the buyer at the right part. */
export type WalletFailureReason = "fail" | "invalid_shipping_address" | "invalid_payment_data" | "address_unserviceable";

export function walletFailureReason(problem: ExpressProblem): WalletFailureReason {
  if (problem === "country") return "address_unserviceable";
  if (problem === "contact" || problem === "phone") return "invalid_payment_data";
  return "invalid_shipping_address";
}

/**
 * What the answer to confirming a wallet payment says about the charge.
 * "paid": it went through, or is settling. "refused": Stripe turned it down
 * (a card or validation error, or an intent left waiting for another payment
 * method), so nothing was taken. "unknown": anything else, such as a
 * connection or API error, where the payment may have gone through without
 * the page hearing of it; the buyer must not be told they weren't charged.
 */
export type WalletConfirmOutcome = "paid" | "refused" | "unknown";

export function walletConfirmOutcome(result: { errorType?: string; intentStatus?: string }): WalletConfirmOutcome {
  if (result.errorType) return result.errorType === "card_error" || result.errorType === "validation_error" ? "refused" : "unknown";
  if (result.intentStatus === "succeeded" || result.intentStatus === "processing") return "paid";
  return result.intentStatus === "requires_payment_method" ? "refused" : "unknown";
}

/** Why a PayPal shipping address can't be used, as the buyer is told: one of four short reasons. */
export type PayPalAddressReason = "country" | "state" | "postal" | "address";

/**
 * The reason given for details from PayPal that fail on anything but the
 * phone. A name or an email the store can't use counts as the address: the
 * way forward is the same, typing the details into the form.
 */
export function paypalAddressReason(problem: Exclude<ExpressProblem, "phone">): PayPalAddressReason {
  return problem === "contact" ? "address" : problem;
}

/**
 * Whether the server's total for the order is the amount the buyer saw and
 * authorised in the express sheet. When it isn't, the payment must not be
 * confirmed.
 */
export function sameTotal(serverTotal: number, shownCents: number): boolean {
  return Number.isFinite(serverTotal) && toCents(serverTotal) === shownCents;
}

export interface ExpressShippingRate {
  id: string;
  displayName: string;
  /** Cents */
  amount: number;
  deliveryEstimate?: { minimum: { unit: "day"; value: number }; maximum: { unit: "day"; value: number } };
}

/**
 * The single shipping option an express sheet lists. Shipping does not depend
 * on the destination, so there is one rate; the days in transit are added
 * when the destination country is known.
 */
export function expressShippingRate(input: { label: string; shippingCents: number; days?: { min: number; max: number } }): ExpressShippingRate {
  const { label, shippingCents, days } = input;
  return {
    id: "standard",
    displayName: label,
    amount: Math.max(0, Math.round(shippingCents)),
    ...(days && { deliveryEstimate: { minimum: { unit: "day", value: days.min }, maximum: { unit: "day", value: days.max } } }),
  };
}
