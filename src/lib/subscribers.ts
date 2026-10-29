import { prisma } from "@/lib/db";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function saveSubscriberEmail(
  email: string,
  source: string,
): Promise<void> {
  const normalized = normalizeEmail(email);
  if (!normalized) return;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(normalized)) return;

  try {
    await prisma.emailSubscriber.upsert({
      where: { email: normalized },
      update: {},
      create: {
        email: normalized,
        source: source || "unknown",
      },
    });
  } catch {
    // Best effort only: subscribers collection must never block checkout/auth.
  }
}
