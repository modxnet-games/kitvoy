/**
 * The shapes of the ids that tie a PayPal order to a store order. Whatever
 * arrives from a browser or a webhook is checked against these before it is
 * used to look anything up. No imports: every PayPal module shares it.
 */

/** A PayPal order id, as PayPal writes them. */
export const PAYPAL_ID_RE = /^[A-Z0-9]{8,40}$/;

/** A store order id (a cuid: lower-case letters and digits). */
export const STORE_ID_RE = /^[a-z0-9]{20,36}$/;

/**
 * The reference_id of a PayPal order opened by express checkout, where the
 * buyer's address comes from PayPal. A PayPal order opened on the payment
 * step carries the store order's id there instead, so the two never mix.
 */
export const PAYPAL_EXPRESS_REFERENCE = "express-checkout";

/**
 * The query parameter on the address PayPal sends an express buyer back to
 * when the whole page went to PayPal (Meta's in-app browsers): "return" after
 * approving, "cancel" after backing out. The payment step's own redirect uses
 * `pp`, so a return is never read by the wrong flow.
 */
export const EXPRESS_RETURN_PARAM = "ppx";
