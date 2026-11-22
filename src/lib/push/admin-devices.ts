import { prisma } from "@/lib/db";
import { formatPrice } from "@/lib/formatters";
import { orderReferenceOf } from "@/lib/order-reference";
import { isFcmConfigured, sendSalePush, type SalePush } from "./fcm";

const TOKEN_RE = /^[\w:.\-]{20,4096}$/;

/** Saves (or refreshes) a phone's FCM token. */
export async function registerAdminDevice(token: unknown, platform: unknown) {
  if (typeof token !== "string" || !TOKEN_RE.test(token)) return { ok: false as const, error: "Invalid push token" };
  const os = platform === "ios" ? "ios" : "android";
  const device = await prisma.adminDevice.upsert({
    where: { token },
    update: { platform: os, lastSeenAt: new Date() },
    create: { token, platform: os },
  });
  return { ok: true as const, device: { id: device.id, platform: device.platform, lastSeenAt: device.lastSeenAt } };
}

/** Whether this phone's token is registered, and how many phones get order pushes. */
export async function getAdminDeviceStatus(token: unknown) {
  const device =
    typeof token === "string" && TOKEN_RE.test(token)
      ? await prisma.adminDevice.findUnique({
          where: { token },
          select: { platform: true, createdAt: true, lastSeenAt: true },
        })
      : null;
  return {
    registered: Boolean(device),
    device,
    devices: await prisma.adminDevice.count(),
    pushConfigured: isFcmConfigured(),
  };
}

export async function removeAdminDevice(token: unknown) {
  if (typeof token !== "string") return 0;
  return (await prisma.adminDevice.deleteMany({ where: { token } })).count;
}

export interface PushSummary {
  configured: boolean;
  devices: number;
  sent: number;
  failed: number;
  removed: number;
  errors: string[];
}

async function pushToAllDevices(push: SalePush): Promise<PushSummary> {
  const devices = await prisma.adminDevice.findMany({ select: { token: true } });
  const summary: PushSummary = { configured: isFcmConfigured(), devices: devices.length, sent: 0, failed: 0, removed: 0, errors: [] };
  if (!devices.length || !summary.configured) return summary;

  const results = await sendSalePush(devices.map((d) => d.token), push);
  const dead = results.filter((r) => !r.ok && r.unregistered).map((r) => r.token);
  if (dead.length) summary.removed = (await prisma.adminDevice.deleteMany({ where: { token: { in: dead } } })).count;
  for (const r of results) {
    if (r.ok) summary.sent++;
    else {
      summary.failed++;
      if (!r.unregistered) summary.errors.push(r.error);
    }
  }
  return summary;
}

/** What the phones show for a new cash-on-delivery order. `type` stays "sale": the app opens the order from it. */
export function salePush(order: { id: string; reference: string; customerName: string; total: number; city?: string | null; itemCount?: number }): SalePush {
  const pieces = order.itemCount ? ` · ${order.itemCount} ${order.itemCount === 1 ? "pc" : "pcs"}` : "";
  const city = order.city ? ` · ${order.city}` : "";
  return {
    title: `New order · ${formatPrice(order.total)}`,
    body: `${order.customerName}${city}${pieces} · ${order.reference}`,
    data: { type: "sale", orderId: order.id, reference: order.reference, total: order.total.toFixed(2) },
  };
}

/** Rings every registered phone for a new order (best-effort, never throws). */
export async function notifyAdminDevices(order: Parameters<typeof salePush>[0]): Promise<void> {
  try {
    const summary = await pushToAllDevices(salePush(order));
    if (summary.devices && !summary.configured) console.warn("[push] Devices are registered but FIREBASE_SERVICE_ACCOUNT_BASE64 isn't set");
    if (summary.errors.length) console.error("[push] Order notification errors:", summary.errors.join("; "));
  } catch (err) {
    console.error("[push] Order notification failed:", err);
  }
}

/** A sample order push so the owner can hear the custom sound. */
export function sendTestSalePush() {
  const reference = orderReferenceOf("TEST0000");
  return pushToAllDevices({
    ...salePush({ id: "test", reference, customerName: "Test customer", city: "Casablanca", total: 350, itemCount: 2 }),
    data: { type: "test", orderId: "", reference, total: "350.00" },
  });
}
