import { prisma } from "@/lib/db";

import {
  SESSION_TTL_MS,
  hashCheckoutToken,
  isCheckoutToken,
  newCheckoutToken,
  type CheckoutTokenKind,
} from "./resume-token";

/** Creates a token for an order and returns it; only its hash is stored. */
export async function issueCheckoutToken(orderId: string, kind: CheckoutTokenKind, ttlMs: number): Promise<string> {
  const token = newCheckoutToken();
  await prisma.checkoutToken.create({
    data: { tokenHash: hashCheckoutToken(token), kind, orderId, expiresAt: new Date(Date.now() + ttlMs) },
  });
  return token;
}

/** The order a live token of this kind points at, with its lines; null when unknown, expired or of another kind. */
export async function findCheckoutToken(token: unknown, kind: CheckoutTokenKind) {
  if (!isCheckoutToken(token)) return null;
  const row = await prisma.checkoutToken.findUnique({
    where: { tokenHash: hashCheckoutToken(token) },
    include: { order: { include: { items: true } } },
  });
  if (!row || row.kind !== kind || row.expiresAt.getTime() <= Date.now()) return null;
  return row;
}

/** A saved checkout stays resumable for another 48 hours. */
export async function extendSessionToken(token: string): Promise<void> {
  await prisma.checkoutToken.updateMany({
    where: { tokenHash: hashCheckoutToken(token), kind: "session" },
    data: { expiresAt: new Date(Date.now() + SESSION_TTL_MS) },
  });
}

/** Housekeeping: tokens that ran out more than a day ago are of no use to anyone. */
export async function pruneExpiredCheckoutTokens(): Promise<void> {
  await prisma.checkoutToken
    .deleteMany({ where: { expiresAt: { lt: new Date(Date.now() - 24 * 60 * 60 * 1000) } } })
    .catch(() => {});
}
