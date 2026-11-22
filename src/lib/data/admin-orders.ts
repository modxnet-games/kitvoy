import type { FulfillmentStatus, Order, OrderItem, OrderStatus, Prisma } from "@prisma/client";

import { SHIPPING_COUNTRY } from "@/config/catalog";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/db";
import { CITIES, parseMoroccanPhone, westernDigits, whatsappLink } from "@/lib/morocco";
import { orderReferenceOf } from "@/lib/order-reference";

/*
 * The owner's side of cash-on-delivery orders: the list, one order, its status
 * and its details, for the web dashboard and the admin app alike.
 *
 * Everything here reads and writes cash-on-delivery orders only. The few card
 * orders left from the old store stay in the database and are never listed,
 * counted, opened or changed.
 *
 * An order is PENDING when placed (new, waiting for the confirmation call),
 * then CONFIRMED, SHIPPED and DELIVERED, with NO_ANSWER, CANCELED and RETURNED
 * on the side. Any status may follow any other, so a mistake can be corrected.
 */

const COD_ONLY = { paymentMethod: "cod" } as const;

/** The statuses an order can be given. PREPARING is left over from the old store and is never set. */
export const COD_STATUSES = ["PENDING", "NO_ANSWER", "CONFIRMED", "SHIPPED", "DELIVERED", "RETURNED", "CANCELED"] as const satisfies readonly OrderStatus[];
export type CodStatus = (typeof COD_STATUSES)[number];
export type StatusCounts = Record<CodStatus, number>;

export function isCodStatus(value: unknown): value is CodStatus {
  return typeof value === "string" && (COD_STATUSES as readonly string[]).includes(value);
}

/**
 * The statuses a `?status=` filter names: one, or several separated by commas,
 * in any letter case. An empty list means every status. Null means the filter
 * names something that is not a status, so it can match no order.
 */
export function parseStatusFilter(value: string | null | undefined): CodStatus[] | null {
  const statuses: CodStatus[] = [];
  for (const part of (value ?? "").split(",")) {
    const name = part.trim().toUpperCase();
    if (!name) continue;
    if (!isCodStatus(name)) return null;
    if (!statuses.includes(name)) statuses.push(name);
  }
  return statuses;
}

/* ------------------------------------------------------------------ */
/*  The order as the admin API returns it                              */
/* ------------------------------------------------------------------ */

const ORDER_INCLUDE = { items: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] } } satisfies Prisma.OrderInclude;

export type OrderWithItems = Order & { items: OrderItem[] };

/**
 * What every admin endpoint answers for an order: each column of the row and
 * its items, plus the reference, the phone in international form, a WhatsApp
 * link and the number of pieces. The columns of the old store (fulfillmentStatus,
 * paymentStatus, email…) stay in it: an older version of the app reads them.
 */
export function serializeOrder(order: OrderWithItems) {
  return {
    ...order,
    reference: orderReferenceOf(order.id),
    phoneE164: parseMoroccanPhone(order.phone)?.e164 ?? null,
    whatsappUrl: whatsappLink(order.phone),
    itemsCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

export type SerializedOrder = ReturnType<typeof serializeOrder>;

/* ------------------------------------------------------------------ */
/*  Search                                                             */
/* ------------------------------------------------------------------ */

/** Lower case, without accents, Arabic marks, spaces or punctuation: "Fès" and "fes", "Tan-Tan" and "tantan" compare equal. */
const fold = (text: string) =>
  text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");

/** The cities of the checkout list a search names, typed in French (with or without accents) or in Arabic, as they are stored on orders. */
export function cityNamesMatching(q: string): string[] {
  const needle = fold(q);
  if (needle.length < 2) return [];
  return CITIES.filter((city) => fold(city.fr).includes(needle) || fold(city.ar).includes(needle)).map((city) => city.fr);
}

/**
 * The digits to look for in stored phone numbers (kept as 0612345678) when a
 * search is a phone number, however it was typed: "+212 612-345678",
 * "00212612345678", "06 12 34 56 78" and "612345678" all give "612345678".
 * Part of a number works too ("0612" gives "612"). Null when the search is not
 * a number, or leaves fewer than three digits.
 */
export function phoneSearchDigits(q: string): string | null {
  const text = westernDigits(q).trim();
  if (!/^[\d\s+().-]+$/.test(text)) return null;
  let digits = text.replace(/\D/g, "");
  if (digits.startsWith("00212")) digits = digits.slice(5);
  // After the country code a Moroccan number starts with 5, 6 or 7 (some people keep the 0 as well)
  else if (/^212(0?[5-7]|0?$)/.test(digits)) digits = digits.slice(3);
  if (digits.startsWith("0")) digits = digits.slice(1);
  return digits.length >= 3 ? digits : null;
}

/**
 * The end of an order id a search names: a whole reference ("CHR-1A2B3C4D",
 * with or without the prefix) or its last characters ("3C4D"). Null when the
 * search cannot be one.
 */
export function referenceSearchSuffix(q: string): string | null {
  const prefix = siteConfig.orderPrefix.toLowerCase();
  let code = q.trim().toLowerCase();
  const separated = new RegExp(`^${prefix}[\\s-]+`);
  if (separated.test(code)) code = code.replace(separated, "");
  else if (code.startsWith(prefix) && code.length === prefix.length + 8) code = code.slice(prefix.length);
  return /^[a-z0-9]{3,8}$/.test(code) ? code : null;
}

/** What the search box can find an order by: its reference, the customer's name, the phone or the city. An order matches when any of these does. */
export function orderSearchConditions(q: string): Prisma.OrderWhereInput[] {
  const text = westernDigits(q).replace(/\s+/g, " ").trim().slice(0, 80);
  if (!text) return [];
  const conditions: Prisma.OrderWhereInput[] = [
    { customerName: { contains: text, mode: "insensitive" } },
    { city: { contains: text, mode: "insensitive" } },
  ];
  const cities = cityNamesMatching(text);
  if (cities.length > 0) conditions.push({ city: { in: cities } });
  const suffix = referenceSearchSuffix(text);
  if (suffix) conditions.push({ id: { endsWith: suffix, mode: "insensitive" } });
  const digits = phoneSearchDigits(text);
  if (digits) conditions.push({ phone: { contains: digits } });
  return conditions;
}

/* ------------------------------------------------------------------ */
/*  Reading                                                            */
/* ------------------------------------------------------------------ */

const DEFAULT_ORDER_LIMIT = 300;
export const MAX_ORDER_LIMIT = 1000;

/** How many orders a list may return: 300 unless asked otherwise, never more than 1000. */
export function clampOrderLimit(value: unknown): number {
  const n = typeof value === "number" ? Math.trunc(value) : typeof value === "string" && /^\d+$/.test(value.trim()) ? Number.parseInt(value, 10) : NaN;
  if (!Number.isFinite(n) || n < 1) return DEFAULT_ORDER_LIMIT;
  return Math.min(n, MAX_ORDER_LIMIT);
}

export interface OrderListFilter {
  /** One status or several; none means every status */
  status?: CodStatus | CodStatus[] | null;
  /** The search box: a reference, a name, a phone or a city */
  q?: string | null;
  /** The most orders to return (see clampOrderLimit) */
  limit?: number | string | null;
}

function orderWhere({ status, q }: Pick<OrderListFilter, "status" | "q">): Prisma.OrderWhereInput {
  const statuses = status == null ? [] : Array.isArray(status) ? status : [status];
  const search = q ? orderSearchConditions(q) : [];
  return {
    ...COD_ONLY,
    ...(statuses.length > 0 && { status: { in: statuses } }),
    ...(search.length > 0 && { OR: search }),
  };
}

/** Cash-on-delivery orders, newest first. */
export async function listOrders(filter: OrderListFilter = {}): Promise<OrderWithItems[]> {
  return prisma.order.findMany({
    where: orderWhere(filter),
    include: ORDER_INCLUDE,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: clampOrderLimit(filter.limit),
  });
}

/** How many orders each status holds; with a search, only among the orders it finds. */
export async function countOrdersByStatus(q?: string | null): Promise<StatusCounts> {
  const groups = await prisma.order.groupBy({ by: ["status"], where: orderWhere({ q }), _count: { _all: true } });
  const counts: StatusCounts = { PENDING: 0, NO_ANSWER: 0, CONFIRMED: 0, SHIPPED: 0, DELIVERED: 0, RETURNED: 0, CANCELED: 0 };
  for (const group of groups) {
    if (isCodStatus(group.status)) counts[group.status] = group._count._all;
  }
  return counts;
}

export async function getOrderById(id: string): Promise<OrderWithItems | null> {
  return prisma.order.findFirst({ where: { id, ...COD_ONLY }, include: ORDER_INCLUDE });
}

/** The figures of GET /api/admin/dashboard/stats, which an older version of the app reads. */
export async function getOrderStats() {
  const [counts, recent, delivered] = await Promise.all([
    countOrdersByStatus(),
    prisma.order.count({ where: { ...COD_ONLY, createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } }),
    prisma.order.aggregate({ where: { ...COD_ONLY, status: "DELIVERED" }, _sum: { total: true } }),
  ]);
  return {
    total: COD_STATUSES.reduce((sum, status) => sum + counts[status], 0),
    pending: counts.PENDING,
    delivered: counts.DELIVERED,
    canceled: counts.CANCELED,
    recent,
    revenue: Math.round((delivered._sum.total ?? 0) * 100) / 100,
  };
}

/* ------------------------------------------------------------------ */
/*  Rules of a status change (no database: tested on their own)        */
/* ------------------------------------------------------------------ */

/** The columns a status decides, besides the status itself. */
export interface StatusColumns {
  status: OrderStatus;
  paymentStatus: string;
  fulfillmentStatus: FulfillmentStatus;
  confirmedAt: Date | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
}

/**
 * The same columns once the order has the given status.
 *
 * - CONFIRMED stamps the confirmation, SHIPPED the confirmation and the
 *   shipment, DELIVERED all three. A stamp is written once: the first time is
 *   kept, also when the order later moves back (to PENDING, NO_ANSWER…).
 * - The cash is collected on delivery: DELIVERED is "paid", anything else
 *   "unpaid" with no delivery time.
 * - fulfillmentStatus is the old store's column, kept in step for the older
 *   app: SHIPPED, DELIVERED, otherwise UNFULFILLED.
 */
export function statusChangeData(current: Pick<StatusColumns, "confirmedAt" | "shippedAt" | "deliveredAt">, status: CodStatus, now: Date = new Date()): StatusColumns {
  const confirmed = status === "CONFIRMED" || status === "SHIPPED" || status === "DELIVERED";
  const shipped = status === "SHIPPED" || status === "DELIVERED";
  const delivered = status === "DELIVERED";
  return {
    status,
    paymentStatus: delivered ? "paid" : "unpaid",
    fulfillmentStatus: delivered ? "DELIVERED" : shipped ? "SHIPPED" : "UNFULFILLED",
    confirmedAt: confirmed ? (current.confirmedAt ?? now) : current.confirmedAt,
    shippedAt: shipped ? (current.shippedAt ?? now) : current.shippedAt,
    deliveredAt: delivered ? (current.deliveredAt ?? now) : null,
  };
}

export type StockMove = "release" | "take" | "none";

/**
 * What a status does to the stock. An order's pieces leave the stock when it
 * is placed and come back when it is canceled or returned; `stockHeld` says
 * which side they are on, so asking for the same status twice moves nothing.
 */
export function stockMoveFor(stockHeld: boolean, status: CodStatus): StockMove {
  const givesBack = status === "CANCELED" || status === "RETURNED";
  if (givesBack) return stockHeld ? "release" : "none";
  return stockHeld ? "none" : "take";
}

/** Pieces per product on an order. Stock is kept per product, so colours and sizes add up; a line whose product is gone holds none. */
export function unitsByProduct(items: { productId: string | null; quantity: number }[]): Map<string, number> {
  const units = new Map<string, number>();
  for (const item of items) {
    if (!item.productId) continue;
    units.set(item.productId, (units.get(item.productId) ?? 0) + item.quantity);
  }
  return units;
}

/** How much of what an order needs can leave a stock without taking it below zero. */
export function takeFromStock(needed: number, available: number): { taken: number; short: number } {
  const taken = Math.max(0, Math.min(needed, available));
  return { taken, short: needed - taken };
}

export interface StockShortage {
  name: string;
  needed: number;
  available: number;
}

/** What the owner is told when an order is brought back to life and the stock no longer covers it. */
export function stockWarning(shortages: StockShortage[]): string | undefined {
  if (shortages.length === 0) return undefined;
  const lines = shortages.map((s) => `${s.name}: ${s.needed} needed, ${s.available} in stock`);
  return `Not enough stock for this order (${lines.join("; ")}). What was left has been taken and the stock is now 0: restock before shipping.`;
}

/* ------------------------------------------------------------------ */
/*  Rules of an edit (no database)                                     */
/* ------------------------------------------------------------------ */

export interface OrderDetailsInput {
  adminNote?: unknown;
  trackingNumber?: unknown;
  customerName?: unknown;
  phone?: unknown;
  city?: unknown;
  address?: unknown;
}

export interface OrderDetails {
  adminNote?: string | null;
  trackingNumber?: string | null;
  customerName?: string;
  /** National form: 0612345678 */
  phone?: string;
  city?: string;
  address?: string;
}

const NOTE_MAX = 1000;
/** Courier tracking numbers: 3 to 64 letters, digits, spaces and dashes */
const TRACKING_RE = /^[A-Za-z0-9][A-Za-z0-9 -]{2,63}$/;

/** As the checkout form cleans what a customer types: Western digits, single spaces, no edges. */
const squeeze = (value: string) => westernDigits(value).replace(/\s+/g, " ").trim();

function readText(value: unknown, label: string, max: number): { text: string } | { error: string } {
  if (typeof value !== "string") return { error: `${label} must be text` };
  const text = squeeze(value);
  if (!text) return { error: `${label} can't be empty` };
  if (text.length > max) return { error: `${label} is too long (${max} characters at most)` };
  return { text };
}

/**
 * The fields of an edit, trimmed and checked. Only the fields that were sent
 * are returned; the first problem found is the error. An empty note or
 * tracking number clears it (null).
 */
export function parseOrderDetails(input: OrderDetailsInput): { ok: true; data: OrderDetails } | { ok: false; error: string } {
  const data: OrderDetails = {};
  const invalid = (error: string) => ({ ok: false as const, error });

  if (input.adminNote !== undefined) {
    if (input.adminNote !== null && typeof input.adminNote !== "string") return invalid("The note must be text");
    const note = (input.adminNote ?? "").trim();
    if (note.length > NOTE_MAX) return invalid(`The note is too long (${NOTE_MAX} characters at most)`);
    data.adminNote = note || null;
  }
  if (input.trackingNumber !== undefined) {
    if (input.trackingNumber !== null && typeof input.trackingNumber !== "string") return invalid("The tracking number must be text");
    const tracking = squeeze(input.trackingNumber ?? "");
    if (tracking && !TRACKING_RE.test(tracking)) return invalid("The tracking number should be 3 to 64 letters, digits, spaces or dashes");
    data.trackingNumber = tracking || null;
  }
  if (input.customerName !== undefined) {
    const name = readText(input.customerName, "The customer name", 80);
    if ("error" in name) return invalid(name.error);
    data.customerName = name.text;
  }
  if (input.phone !== undefined) {
    const phone = typeof input.phone === "string" ? parseMoroccanPhone(input.phone) : null;
    if (!phone) return invalid("Enter a Moroccan phone number, like 0612345678");
    data.phone = phone.national;
  }
  if (input.city !== undefined) {
    const city = readText(input.city, "The city", 60);
    if ("error" in city) return invalid(city.error);
    data.city = city.text;
  }
  if (input.address !== undefined) {
    const address = readText(input.address, "The address", 200);
    if ("error" in address) return invalid(address.error);
    data.address = address.text;
  }
  return { ok: true, data };
}

type AddressColumns = Pick<Order, "location" | "city" | "shippingAddress">;

/** The address line of an order: what the customer typed, without the city. */
export function addressLineOf(order: AddressColumns): string {
  const stored = order.shippingAddress;
  if (stored && typeof stored === "object" && !Array.isArray(stored) && typeof stored.address1 === "string" && stored.address1.trim()) {
    return stored.address1.trim();
  }
  const city = order.city?.trim();
  if (city && order.location.endsWith(`, ${city}`)) return order.location.slice(0, -(city.length + 2)).trim();
  return order.location;
}

/**
 * The columns an edit writes. The city and the address live in three places
 * (city, the one-line `location`, the structured `shippingAddress`), so a
 * change to either rewrites all three, as the checkout wrote them.
 */
export function detailsChange(order: AddressColumns, details: OrderDetails) {
  const { city, address, ...rest } = details;
  if (city === undefined && address === undefined) return rest;
  const nextCity = city ?? order.city?.trim() ?? "";
  const nextAddress = address ?? addressLineOf(order);
  return {
    ...rest,
    city: nextCity || null,
    location: nextCity ? `${nextAddress}, ${nextCity}` : nextAddress,
    shippingAddress: { address1: nextAddress, city: nextCity, country: SHIPPING_COUNTRY },
  };
}

/* ------------------------------------------------------------------ */
/*  Writing                                                            */
/* ------------------------------------------------------------------ */

export type OrderUpdateResult =
  | { ok: true; order: OrderWithItems; warning?: string }
  | { ok: false; error: string; status: number };

const NOT_FOUND = { ok: false, error: "Order not found", status: 404 } as const;

/** JSON with its keys in one order, so two equal objects read the same however the database returns them. */
const stableJson = (value: unknown): string =>
  JSON.stringify(value, (_key, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v,
  );

function sameValue(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  if (a && b && typeof a === "object" && typeof b === "object") return stableJson(a) === stableJson(b);
  return a === b;
}

/** The fields of `next` that differ from the row: saving the same thing twice writes nothing. */
export function changedOnly<T extends object>(row: object, next: T): Partial<T> {
  const changed: Partial<T> = {};
  for (const key of Object.keys(next) as (keyof T)[]) {
    if (!sameValue((row as Record<PropertyKey, unknown>)[key], next[key])) changed[key] = next[key];
  }
  return changed;
}

/**
 * Reads an order and keeps its row locked until the transaction ends, so two
 * requests on the same order (a double tap, the app and the dashboard at once)
 * run one after the other and the stock is never moved twice.
 */
async function lockOrder(tx: Prisma.TransactionClient, id: string): Promise<OrderWithItems | null> {
  await tx.$queryRaw`SELECT "id" FROM "orders" WHERE "id" = ${id} FOR UPDATE`;
  return tx.order.findFirst({ where: { id, ...COD_ONLY }, include: ORDER_INCLUDE });
}

/** Products in one fixed order, so two transactions never wait on each other's rows. */
const sortedUnits = (items: OrderItem[]) => [...unitsByProduct(items)].sort(([a], [b]) => a.localeCompare(b));

async function releaseStock(tx: Prisma.TransactionClient, items: OrderItem[]): Promise<void> {
  for (const [productId, units] of sortedUnits(items)) {
    // A product deleted since the order was placed has no stock to give back to
    await tx.product.updateMany({ where: { id: productId }, data: { stock: { increment: units } } });
  }
}

/** Takes an order's pieces out of stock again, down to zero at the lowest; returns what to tell the owner when there were not enough. */
async function takeStock(tx: Prisma.TransactionClient, items: OrderItem[]): Promise<string | undefined> {
  const shortages: StockShortage[] = [];
  for (const [productId, units] of sortedUnits(items)) {
    const rows = await tx.$queryRaw<{ name: string; stock: number }[]>`SELECT "name", "stock" FROM "products" WHERE "id" = ${productId} FOR UPDATE`;
    const product = rows[0];
    if (!product) continue;
    const { taken, short } = takeFromStock(units, product.stock);
    if (taken > 0) await tx.product.update({ where: { id: productId }, data: { stock: { decrement: taken } } });
    if (short > 0) shortages.push({ name: product.name, needed: units, available: Math.max(0, product.stock) });
  }
  return stockWarning(shortages);
}

/*
 * Each write is a function of a transaction (the ...In functions), run by its
 * public wrapper inside prisma.$transaction. The tests run the same functions
 * against an in-memory stand-in, so the whole sequence (lock, stock, columns)
 * is covered without a database.
 */

export async function setOrderStatusIn(tx: Prisma.TransactionClient, id: string, status: CodStatus, now: Date): Promise<OrderUpdateResult> {
  const order = await lockOrder(tx, id);
  if (!order) return NOT_FOUND;

  const move = stockMoveFor(order.stockHeld, status);
  let warning: string | undefined;
  if (move === "release") await releaseStock(tx, order.items);
  if (move === "take") warning = await takeStock(tx, order.items);

  const data = changedOnly(order, {
    ...statusChangeData(order, status, now),
    stockHeld: move === "none" ? order.stockHeld : move === "take",
  });
  if (Object.keys(data).length === 0) return { ok: true, order };
  const updated = await tx.order.update({ where: { id }, data, include: ORDER_INCLUDE });
  return { ok: true, order: updated, ...(warning && { warning }) };
}

/**
 * Gives an order a status, with everything that goes with it, in one
 * transaction: the confirmation, shipment and delivery times, the payment
 * (paid on delivery), and the stock (given back on CANCELED and RETURNED,
 * taken again when such an order becomes active). Asking for the status an
 * order already has changes nothing.
 */
export async function setOrderStatus(id: string, status: unknown, now: Date = new Date()): Promise<OrderUpdateResult> {
  if (!isCodStatus(status)) {
    return { ok: false, error: `Invalid status. Valid: ${COD_STATUSES.join(", ")}`, status: 400 };
  }
  return prisma.$transaction((tx) => setOrderStatusIn(tx, id, status, now));
}

export async function updateOrderDetailsIn(tx: Prisma.TransactionClient, id: string, details: OrderDetails): Promise<OrderUpdateResult> {
  const order = await lockOrder(tx, id);
  if (!order) return NOT_FOUND;
  const data = changedOnly(order, detailsChange(order, details));
  if (Object.keys(data).length === 0) return { ok: true, order };
  const updated = await tx.order.update({ where: { id }, data, include: ORDER_INCLUDE });
  return { ok: true, order: updated };
}

/**
 * Corrects what the owner can correct on an order: the note, the tracking
 * number (optional: many couriers give none), the customer's name and phone,
 * the city and the address. A field that fails its check refuses the whole
 * edit, before anything is written.
 */
export async function updateOrderDetails(id: string, input: OrderDetailsInput): Promise<OrderUpdateResult> {
  const parsed = parseOrderDetails(input);
  if (!parsed.ok) return { ok: false, error: parsed.error, status: 400 };
  if (Object.keys(parsed.data).length === 0) return { ok: false, error: "Nothing to update", status: 400 };
  return prisma.$transaction((tx) => updateOrderDetailsIn(tx, id, parsed.data));
}

export async function deleteOrderIn(tx: Prisma.TransactionClient, id: string): Promise<boolean> {
  const order = await lockOrder(tx, id);
  if (!order) return false;
  if (order.stockHeld) await releaseStock(tx, order.items);
  await tx.order.delete({ where: { id } });
  return true;
}

/**
 * Deletes an order and its lines. Pieces the order still holds go back in
 * stock first. False when there is no such order.
 */
export async function deleteOrder(id: string): Promise<boolean> {
  return prisma.$transaction((tx) => deleteOrderIn(tx, id));
}
