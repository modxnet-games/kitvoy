import { ADMIN_SENDERS, formatSender, isAdminSenderId } from "@/config/mail-senders";
import { prisma } from "@/lib/db";
import { sendCustomerMessage } from "@/lib/email";

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;
export const MAX_SUBJECT_LENGTH = 200;
export const MAX_BODY_LENGTH = 20_000;

export type AdminEmailInput = {
  sender?: unknown;
  to?: unknown;
  subject?: unknown;
  body?: unknown;
  orderId?: unknown;
};

export type ValidAdminEmail = {
  sender: keyof typeof ADMIN_SENDERS;
  to: string;
  subject: string;
  body: string;
  orderId: string | null;
};

/** Checks an admin email request; returns field errors or the cleaned values. */
export function validateAdminEmail(
  input: AdminEmailInput,
): { ok: true; value: ValidAdminEmail } | { ok: false; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const to = typeof input.to === "string" ? input.to.trim() : "";
  // Single-line header fields only, so nothing can be smuggled into other headers
  const subject = typeof input.subject === "string" ? input.subject.trim().replace(/\s+/g, " ") : "";
  const body = typeof input.body === "string" ? input.body.replace(/\r\n?/g, "\n").trim() : "";
  const orderId = typeof input.orderId === "string" && input.orderId.trim() ? input.orderId.trim() : null;

  if (!isAdminSenderId(input.sender)) errors.sender = "Choose who the email is from";
  if (!to || to.length > 254 || !EMAIL_RE.test(to)) errors.to = "Enter one valid email address";
  if (!subject) errors.subject = "Add a subject";
  else if (subject.length > MAX_SUBJECT_LENGTH) errors.subject = `Keep the subject under ${MAX_SUBJECT_LENGTH} characters`;
  if (!body) errors.body = "Write a message";
  else if (body.length > MAX_BODY_LENGTH) errors.body = `Keep the message under ${MAX_BODY_LENGTH.toLocaleString("en-US")} characters`;

  if (Object.keys(errors).length) return { ok: false, errors };
  return { ok: true, value: { sender: input.sender as ValidAdminEmail["sender"], to, subject, body, orderId } };
}

/** Sends an admin email and logs it, whether or not the send succeeded. */
export async function sendAdminEmail(email: ValidAdminEmail) {
  if (email.orderId) {
    const order = await prisma.order.findUnique({ where: { id: email.orderId }, select: { id: true } });
    if (!order) return { ok: false as const, status: 404, error: "Order not found" };
  }

  const result = await sendCustomerMessage({
    from: ADMIN_SENDERS[email.sender],
    to: email.to,
    subject: email.subject,
    body: email.body,
  });
  const record = await prisma.sentEmail.create({
    data: {
      fromAddress: formatSender(email.sender),
      toAddress: email.to,
      subject: email.subject,
      body: email.body,
      status: result.sent ? "sent" : "failed",
      error: result.sent ? null : result.reason.slice(0, 1000),
      orderId: email.orderId,
    },
  });
  return result.sent
    ? { ok: true as const, email: record }
    : { ok: false as const, status: 502, error: `The email wasn't sent: ${result.reason}`, email: record };
}

export function listSentEmails(options: { orderId?: string; limit?: number } = {}) {
  return prisma.sentEmail.findMany({
    where: options.orderId ? { orderId: options.orderId } : undefined,
    orderBy: { createdAt: "desc" },
    take: Math.min(Math.max(options.limit ?? 50, 1), 100),
  });
}
