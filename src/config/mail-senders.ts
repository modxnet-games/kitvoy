/**
 * Addresses the admin can send customer emails from. Each must be an active
 * Brevo sender on the authenticated kitvoy.com domain; replies go to the same
 * address, which Cloudflare Email Routing forwards to the store inbox.
 */
export const ADMIN_SENDERS = {
  support: { name: "Kitvoy Support", email: "support@kitvoy.com" },
  orders: { name: "Kitvoy", email: "orders@kitvoy.com" },
} as const;

export type AdminSenderId = keyof typeof ADMIN_SENDERS;

export const isAdminSenderId = (value: unknown): value is AdminSenderId =>
  typeof value === "string" && Object.hasOwn(ADMIN_SENDERS, value);

export const formatSender = (id: AdminSenderId) => `${ADMIN_SENDERS[id].name} <${ADMIN_SENDERS[id].email}>`;
