/**
 * Addresses the store sends email from. Each must be an active Brevo sender on
 * the authenticated kitvoy.com domain; replies go to the same address, which
 * Cloudflare Email Routing forwards to the store inbox.
 */
export const ADMIN_SENDERS = {
  support: { name: "Kitvoy Support", email: "support@kitvoy.com" },
  orders: { name: "Kitvoy", email: "orders@kitvoy.com" },
} as const;
