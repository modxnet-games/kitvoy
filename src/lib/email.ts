import { formatPrice } from "@/lib/formatters";
import nodemailer from "nodemailer";

/** Recipient for new order notifications. */
const NOTIFY_EMAIL = process.env.NOTIFY_EMAIL?.trim();
const SMTP_HOST = process.env.SMTP_HOST?.trim();
const SMTP_PORT = process.env.SMTP_PORT?.trim();
const SMTP_USER = process.env.SMTP_USER?.trim();
const SMTP_PASS = process.env.SMTP_PASS?.trim();
const SMTP_SECURE = process.env.SMTP_SECURE === "true";

/** SMTP is enough for customer emails; owner notifications also need NOTIFY_EMAIL. */
function isSmtpConfigured(): boolean {
  return !!(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS);
}

let cachedTransport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter | null {
  if (!isSmtpConfigured()) return null;
  if (cachedTransport) return cachedTransport;
  try {
    const port = Number(SMTP_PORT);
    if (!Number.isInteger(port) || port <= 0) return null;
    cachedTransport = nodemailer.createTransport({
      host: SMTP_HOST,
      port,
      secure: SMTP_SECURE,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });
    return cachedTransport;
  } catch (err) {
    console.error("[email] Failed to create SMTP transport:", err);
    return null;
  }
}

export interface OrderNotificationPayload {
  id: string;
  orderReference: string;
  customerName: string;
  phone: string;
  location: string;
  items: Array<{
    productName: string;
    productSlug: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
  }>;
  subtotal: number;
  shippingCost: number;
  total: number;
  currency: string;
  locale: string;
  paymentMethod?: string | null;
  createdAt: Date;
}

function paymentLabel(method?: string | null): string {
  if (method === "paypal") return "PayPal";
  if (method === "card") return "Credit / debit card (Stripe)";
  return "Online payment";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface HtmlEmailParams {
  order: OrderNotificationPayload;
  dateStr: string;
  shippingLabel: string;
  storeName: string;
  adminOrdersUrl: string;
  formatPrice: (price: number) => string;
}

function buildOrderEmailHtml(params: HtmlEmailParams): string {
  const { order, dateStr, shippingLabel, storeName, adminOrdersUrl, formatPrice } = params;
  const borderColor = "#e5e7eb";
  const mutedColor = "#6b7280";
  const brandColor = "#111827";

  return (
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>New order ${escapeHtml(order.orderReference)} — ${escapeHtml(storeName)}</title>
</head>
<body style="margin:0; padding:0; font-family: Arial, Helvetica, sans-serif; font-size: 14px; line-height: 1.5; color: #374151; background-color: #f3f4f6;">
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: #f3f4f6;">
    <tr>
      <td style="padding: 24px 16px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 560px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; border: 1px solid ${borderColor}; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
          <!-- Header / Brand -->
          <tr>
            <td style="padding: 24px 24px 16px 24px; border-bottom: 2px solid ${borderColor};">
              <p style="margin:0; font-size: 22px; font-weight: 700; color: ${brandColor}; letter-spacing: -0.02em;">${escapeHtml(storeName)}</p>
              <p style="margin: 6px 0 0 0; font-size: 12px; color: ${mutedColor}; text-transform: uppercase; letter-spacing: 0.05em;">New order notification</p>
            </td>
          </tr>
          <!-- Order summary block -->
          <tr>
            <td style="padding: 20px 24px; border-bottom: 1px solid ${borderColor};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td style="padding: 4px 0;">
                    <span style="font-size: 11px; color: ${mutedColor}; text-transform: uppercase; letter-spacing: 0.05em;">Order reference</span><br>
                    <span style="font-size: 18px; font-weight: 700; color: ${brandColor}; font-family: 'Consolas', 'Monaco', monospace;">${escapeHtml(order.orderReference)}</span>
                  </td>
                </tr>
                <tr><td style="height: 12px;"></td></tr>
                <tr>
                  <td style="padding: 4px 0; font-size: 13px; color: ${mutedColor};">
                    ${escapeHtml(dateStr)}
                  </td>
                </tr>
                <tr><td style="height: 8px;"></td></tr>
                <tr>
                  <td>
                    <span style="display: inline-block; padding: 4px 10px; font-size: 12px; font-weight: 600; color: #065f46; background-color: #d1fae5; border-radius: 4px;">${escapeHtml(paymentLabel(order.paymentMethod))}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Customer block -->
          <tr>
            <td style="padding: 20px 24px; border-bottom: 1px solid ${borderColor};">
              <p style="margin: 0 0 10px 0; font-size: 11px; color: ${mutedColor}; text-transform: uppercase; letter-spacing: 0.05em;">Customer</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0">
                <tr><td style="padding: 2px 0;"><strong>Name</strong></td><td style="padding: 2px 0 2px 12px;">${escapeHtml(order.customerName)}</td></tr>
                <tr><td style="padding: 2px 0;"><strong>Phone</strong></td><td style="padding: 2px 0 2px 12px;"><a href="tel:${escapeHtml(order.phone)}" style="color: #2563eb; text-decoration: none;">${escapeHtml(order.phone)}</a></td></tr>
                <tr><td style="padding: 2px 0;"><strong>Location</strong></td><td style="padding: 2px 0 2px 12px;">${escapeHtml(order.location)}</td></tr>
              </table>
            </td>
          </tr>
          <!-- Items table -->
          <tr>
            <td style="padding: 20px 24px; border-bottom: 1px solid ${borderColor};">
              <p style="margin: 0 0 12px 0; font-size: 11px; color: ${mutedColor}; text-transform: uppercase; letter-spacing: 0.05em;">Order items</p>
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border: 1px solid ${borderColor}; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #f9fafb;">
                    <th style="text-align: left; padding: 10px 12px; font-size: 12px; color: ${mutedColor}; font-weight: 600; border-bottom: 1px solid ${borderColor}; border-right: 1px solid ${borderColor};">Product</th>
                    <th style="text-align: center; padding: 10px 12px; font-size: 12px; color: ${mutedColor}; font-weight: 600; border-bottom: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; width: 60px;">Qty</th>
                    <th style="text-align: right; padding: 10px 12px; font-size: 12px; color: ${mutedColor}; font-weight: 600; border-bottom: 1px solid ${borderColor}; border-right: 1px solid ${borderColor}; width: 90px;">Unit price</th>
                    <th style="text-align: right; padding: 10px 12px; font-size: 12px; color: ${mutedColor}; font-weight: 600; border-bottom: 1px solid ${borderColor};">Line total</th>
                  </tr>
                </thead>
                <tbody>
${order.items
  .map((i, idx) => {
    const rowBg = idx % 2 === 0 ? "#ffffff" : "#fafafa";
    return [
      "                  <tr style=\"background-color: " + rowBg + ";\">",
      "                    <td style=\"padding: 10px 12px; border-bottom: 1px solid " + borderColor + "; border-right: 1px solid " + borderColor + ";\">",
      "                      <span style=\"font-weight: 500;\">" + escapeHtml(i.productName) + "</span><br>",
      "                      <span style=\"font-size: 12px; color: " + mutedColor + ";\">" + escapeHtml(i.productSlug) + "</span>",
      "                    </td>",
      "                    <td style=\"text-align: center; padding: 10px 12px; border-bottom: 1px solid " + borderColor + "; border-right: 1px solid " + borderColor + ";\">" + i.quantity + "</td>",
      "                    <td style=\"text-align: right; padding: 10px 12px; border-bottom: 1px solid " + borderColor + "; border-right: 1px solid " + borderColor + ";\">" + formatPrice(i.unitPrice) + "</td>",
      "                    <td style=\"text-align: right; padding: 10px 12px; border-bottom: 1px solid " + borderColor + "; font-weight: 600;\">" + formatPrice(i.lineTotal) + "</td>",
      "                  </tr>",
    ].join("\n");
  })
  .join("\n")}
                </tbody>
              </table>
            </td>
          </tr>
          <!-- Totals block -->
          <tr>
            <td style="padding: 20px 24px; border-bottom: 1px solid ${borderColor};">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr><td style="padding: 4px 0; color: ${mutedColor};">Subtotal</td><td style="text-align: right; padding: 4px 0;">${formatPrice(order.subtotal)}</td></tr>
                <tr><td style="padding: 4px 0; color: ${mutedColor};">Shipping</td><td style="text-align: right; padding: 4px 0;">${shippingLabel}</td></tr>
                <tr><td style="padding: 12px 0 4px 0; font-size: 16px; font-weight: 700; color: ${brandColor};">Total</td><td style="text-align: right; padding: 12px 0 4px 0; font-size: 16px; font-weight: 700; color: ${brandColor};">${formatPrice(order.total)}</td></tr>
              </table>
            </td>
          </tr>
          <!-- Footer / Metadata -->
          <tr>
            <td style="padding: 20px 24px; background-color: #f9fafb; border-radius: 0 0 8px 8px;">
              <p style="margin: 0 0 8px 0; font-size: 12px; color: ${mutedColor};">Order ID: <code style="font-family: 'Consolas', 'Monaco', monospace; font-size: 11px;">${escapeHtml(order.id)}</code></p>
              <p style="margin: 0; font-size: 13px;">
                <a href="${escapeHtml(adminOrdersUrl)}" style="color: #2563eb; font-weight: 600; text-decoration: none;">Review this order in the admin dashboard →</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
  );
}

/**
 * Send a new-order notification to the configured NOTIFY_EMAIL.
 * Fails gracefully: logs errors and does not throw. Order creation must not depend on this.
 */
export async function sendOrderNotification(
  order: OrderNotificationPayload
): Promise<{ sent: true } | { sent: false; reason: string }> {
  const transport = NOTIFY_EMAIL ? getTransport() : null;
  if (!transport) {
    const reason = "Email not configured (missing NOTIFY_EMAIL or SMTP_* env vars)";
    if (process.env.NODE_ENV === "development") {
      console.warn("[email]", reason);
    }
    return { sent: false, reason };
  }

  const dateStr = new Date(order.createdAt).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

  const storeName = "Kitvoy";
  const storeUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const adminOrdersUrl = `${storeUrl.replace(/\/$/, "")}/admin/orders`;
  const shippingLabel = order.shippingCost === 0 ? "Free" : formatPrice(order.shippingCost);

  // Plain text version — clear sections and structure
  const textLines: string[] = [
    `${storeName}`,
    "New order notification",
    "—".repeat(40),
    "",
    "ORDER SUMMARY",
    "  Reference:  " + order.orderReference,
    "  Date:       " + dateStr,
    "  Payment:    " + paymentLabel(order.paymentMethod),
    "",
    "CUSTOMER",
    "  Name:       " + order.customerName,
    "  Phone:      " + order.phone,
    "  Location:   " + order.location,
    "",
    "ITEMS",
    "  " + "Product".padEnd(32) + "Qty   Unit price    Line total",
    "  " + "—".repeat(70),
    ...order.items.map((i) => {
      const name = (i.productName + " (" + i.productSlug + ")").slice(0, 30).padEnd(32);
      const qty = String(i.quantity).padStart(3);
      const unit = formatPrice(i.unitPrice).padStart(12);
      const line = formatPrice(i.lineTotal).padStart(12);
      return "  " + name + qty + unit + line;
    }),
    "",
    "TOTALS",
    "  Subtotal:   " + formatPrice(order.subtotal),
    "  Shipping:   " + shippingLabel,
    "  Total:      " + formatPrice(order.total),
    "",
    "—".repeat(40),
    "Order ID: " + order.id,
    "Review this order in the admin dashboard: " + adminOrdersUrl,
  ];
  const text = textLines.join("\n");

  // HTML version — email-client safe: tables, inline styles, no external CSS
  const html = buildOrderEmailHtml({
    order,
    dateStr,
    shippingLabel,
    storeName,
    adminOrdersUrl,
    formatPrice: (p: number) => formatPrice(p),
  });

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM?.trim() || SMTP_USER,
      to: NOTIFY_EMAIL,
      subject: `New order: ${order.orderReference}`,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] Failed to send order notification:", message);
    return { sent: false, reason: message };
  }
}


/* ------------------------------------------------------------------ */
/*  Customer shipping confirmation                                     */
/* ------------------------------------------------------------------ */

export interface ShippingConfirmationPayload {
  to: string;
  customerName: string;
  orderReference: string;
  trackingNumber: string;
  trackingUrl: string;
  shipTo: string[];
  items: { productName: string; quantity: number }[];
  /** True when the tracking number changed after the first "shipped" email */
  isUpdate?: boolean;
}

/**
 * Emails the customer that their order shipped, with the tracking link.
 * Needs SMTP_* only (not NOTIFY_EMAIL). Never throws.
 */
export async function sendShippingConfirmation(
  p: ShippingConfirmationPayload,
): Promise<{ sent: true } | { sent: false; reason: string }> {
  const transport = getTransport();
  if (!transport) return { sent: false, reason: "SMTP is not configured (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS)" };

  const { subject, text, html } = buildShippingEmail(p);
  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM?.trim() || SMTP_USER,
      to: p.to,
      subject,
      text,
      html,
    });
    return { sent: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[email] Failed to send shipping confirmation:", message);
    return { sent: false, reason: message };
  }
}

/** Subject, plain text and HTML for the shipping email (no sending). */
export function buildShippingEmail(p: ShippingConfirmationPayload): { subject: string; text: string; html: string } {
  const storeName = "Kitvoy";
  const firstName = p.customerName.trim().split(/\s+/)[0] || "there";
  const headline = p.isUpdate ? "Your tracking number was updated" : "Your order is on its way";
  const subject = p.isUpdate
    ? `Updated tracking for your ${storeName} order ${p.orderReference}`
    : `Your ${storeName} order ${p.orderReference} has shipped`;

  const text = [
    `Hi ${firstName},`,
    "",
    p.isUpdate
      ? `The tracking number for your order ${p.orderReference} was updated.`
      : `Good news: your order ${p.orderReference} has shipped.`,
    "",
    `Tracking number: ${p.trackingNumber}`,
    `Track your package: ${p.trackingUrl}`,
    "",
    "Shipping to:",
    ...p.shipTo.map((l) => `  ${l}`),
    "",
    "In this shipment:",
    ...p.items.map((i) => `  ${i.quantity} × ${i.productName}`),
    "",
    "Tracking can take a day or two to show the first scan.",
    "Questions? Just reply to this email.",
    "",
    `— ${storeName}`,
  ].join("\n");

  const ink = "#0B0B0F";
  const orange = "#FF7A1A";
  const muted = "#5A5A66";
  const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:0;background:#F4F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${ink};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F4F6;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#FFFFFF;border-radius:12px;overflow:hidden;">
        <tr><td style="background:${ink};padding:20px 28px;color:#FFFFFF;font-size:20px;font-weight:800;">${storeName}</td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 8px;font-size:22px;font-weight:800;">${escapeHtml(headline)}</p>
          <p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:${muted};">Hi ${escapeHtml(firstName)}, ${
            p.isUpdate ? "here’s the new tracking number for" : "your package is with the carrier. Here’s how to follow"
          } order <strong style="color:${ink};">${escapeHtml(p.orderReference)}</strong>.</p>
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#F4F4F6;border-radius:10px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:${muted};">Tracking number</p>
              <p style="margin:4px 0 0;font-size:18px;font-weight:700;font-family:Consolas,Monaco,monospace;">${escapeHtml(p.trackingNumber)}</p>
            </td></tr>
          </table>
          <p style="margin:20px 0;"><a href="${escapeHtml(p.trackingUrl)}" style="display:inline-block;background:${orange};color:${ink};text-decoration:none;font-weight:700;font-size:15px;padding:13px 22px;border-radius:10px;">Track your package</a></p>
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;">Shipping to</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:${muted};">${p.shipTo.map(escapeHtml).join("<br>")}</p>
          <p style="margin:0 0 6px;font-size:13px;font-weight:700;">In this shipment</p>
          <p style="margin:0 0 18px;font-size:14px;line-height:1.5;color:${muted};">${p.items
            .map((i) => `${i.quantity} × ${escapeHtml(i.productName)}`)
            .join("<br>")}</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:${muted};">Tracking can take a day or two to show the first scan. Questions? Just reply to this email.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { subject, text, html };
}
