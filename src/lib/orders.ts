import { prisma } from "@/lib/db";
import { getCatalogProduct, getCatalogVariant } from "@/config/catalog";
import type { OrderAttribution } from "@/lib/analytics/attribution";
import { priceLines } from "@/lib/bundles";
import { readCheckoutDetails, readLocale, validateCheckoutDetails, type CheckoutDetails } from "@/lib/checkout-details";
import { DEFAULT_LOCALE, type Locale } from "@/lib/i18n";
import { toCents, type OrderTotals } from "@/lib/money";
import { parseMoroccanPhone } from "@/lib/morocco";
import { orderReferenceOf } from "@/lib/order-reference";

/*
 * Cash-on-delivery orders. The customer fills in a name, a phone number, a
 * city and an address; the order is saved as PENDING (new, waiting for the
 * confirmation call) and its pieces leave the stock at once. Nothing is paid
 * online: the courier collects the cash, and the order becomes paid when it
 * is marked delivered (lib/data/admin-orders.ts).
 */

export interface CartItemPayload {
  productId: string;
  quantity: number;
  /** Colour and size ("black-xl"), for products sold in several */
  variantKey: string | null;
}

export interface CreateOrderInput {
  details: CheckoutDetails;
  locale: Locale;
  items: CartItemPayload[];
  /** Ad attribution and Conversions API inputs read from the request (cookies, IP, user agent) */
  attribution?: OrderAttribution;
}

export type CreateOrderResult =
  | { success: true; orderId: string; orderReference: string; totals: OrderTotals; duplicate: boolean }
  | { success: false; error: string; fields?: Record<string, string> };

const MAX_UNITS = 12;
/** A phone number that keeps ordering is a mistake or a prank; the owner would call it once anyway */
const MAX_ORDERS_PER_PHONE_PER_DAY = 3;
/** Mobile networks put many customers behind one address, so this only stops a flood */
const MAX_ORDERS_PER_IP_PER_HOUR = 30;
const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

/**
 * The cart lines of a request body. Anything malformed is dropped; nothing
 * the browser says about a price is read (the cart is priced from the
 * database).
 */
export function parseCartItems(input: unknown): CartItemPayload[] {
  if (!Array.isArray(input)) return [];
  const items: CartItemPayload[] = [];
  for (const item of input.slice(0, 40)) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const product = it.product && typeof it.product === "object" ? (it.product as Record<string, unknown>) : null;
    const productId = typeof it.productId === "string" ? it.productId : typeof product?.id === "string" ? product.id : "";
    const quantity = typeof it.quantity === "number" && Number.isInteger(it.quantity) ? it.quantity : 0;
    const rawKey = typeof it.variantKey === "string" ? it.variantKey : "";
    if (!/^[a-z0-9]{1,40}$/i.test(productId) || quantity < 1 || quantity > MAX_UNITS) continue;
    items.push({ productId, quantity, variantKey: /^[a-z0-9-]{1,40}$/.test(rawKey) ? rawKey : null });
  }
  return items;
}

/** The request body as an order to create, or the first problem with it. */
export function validateOrderInput(input: unknown): { valid: false; error: string; fields?: Record<string, string> } | { valid: true; data: Omit<CreateOrderInput, "attribution"> } {
  if (!input || typeof input !== "object") return { valid: false, error: "order.errorGeneric" };
  const body = input as Record<string, unknown>;
  // A field no person sees or fills in; a script that fills every input gives itself away
  if (typeof body.website === "string" && body.website.trim()) return { valid: false, error: "order.errorGeneric" };

  const details = readCheckoutDetails(body);
  const fields = validateCheckoutDetails(details);
  const first = Object.values(fields)[0];
  if (first) return { valid: false, error: first, fields };

  const items = parseCartItems(body.items);
  if (items.length === 0) return { valid: false, error: "order.errorEmptyCart" };
  return { valid: true, data: { details, locale: readLocale(body.locale, DEFAULT_LOCALE), items } };
}

export type PricedItem = {
  productId: string;
  productName: string;
  productSlug: string;
  variantKey: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type PricedOrder = { items: PricedItem[]; totals: OrderTotals; unitsByProduct: Map<string, number> };

type Failure = { success: false; error: string };
const failed = (error: string): { ok: false; failure: Failure } => ({ ok: false, failure: { success: false, error } });

/**
 * Prices the cart from the database: one line per product, colour and size,
 * each checked against the catalog; a product bought in several variants is
 * priced as one pack. Stock is read here and taken when the order is saved.
 */
export async function priceCart(items: CartItemPayload[]): Promise<{ ok: true; priced: PricedOrder } | { ok: false; failure: Failure }> {
  const products = await prisma.product.findMany({
    where: { id: { in: [...new Set(items.map((i) => i.productId))] } },
    select: { id: true, name: true, slug: true, price: true, shippingTax: true, stock: true },
  });
  const byId = new Map(products.map((p) => [p.id, p]));

  type Line = { product: (typeof products)[number]; variantKey: string | null; label: string | null; quantity: number };
  const lines = new Map<string, Line>();
  for (const item of items) {
    const product = byId.get(item.productId);
    if (!product) return failed("order.errorUnavailable");
    // Only what the catalog sells can be ordered: rows left from the store this one replaced are not for sale
    const entry = getCatalogProduct(product.slug);
    if (!entry) return failed("order.errorUnavailable");
    let variantKey: string | null = null;
    let label: string | null = null;
    if (entry.colours.length > 0) {
      const variant = getCatalogVariant(product.slug, item.variantKey);
      if (!variant) return failed("order.errorChooseVariant");
      variantKey = variant.key;
      // The owner reads orders in French: "Noir, XL"
      label = `${variant.colour.label.fr}, ${variant.size}`;
    }
    const key = `${product.id}:${variantKey ?? ""}`;
    const line = lines.get(key);
    if (line) line.quantity += item.quantity;
    else lines.set(key, { product, variantKey, label, quantity: item.quantity });
  }
  const merged = [...lines.values()];

  // Stock is kept per product, so its colours and sizes are counted together
  const unitsByProduct = new Map<string, number>();
  for (const line of merged) unitsByProduct.set(line.product.id, (unitsByProduct.get(line.product.id) ?? 0) + line.quantity);
  for (const [productId, units] of unitsByProduct) {
    const stock = byId.get(productId)!.stock;
    if (units > MAX_UNITS) return failed("order.errorNotEnough");
    if (stock <= 0) return failed("order.errorUnavailable");
    if (units > stock) return failed("order.errorNotEnough");
  }

  const lineTotals = priceLines(merged.map((l) => ({ productId: l.product.id, slug: l.product.slug, unitPrice: l.product.price, quantity: l.quantity })));
  const pricedItems: PricedItem[] = merged.map((line, i) => ({
    productId: line.product.id,
    // The colour and size are part of the name wherever the order is read: admin, app, packing slip
    productName: line.label ? `${line.product.name} (${line.label})` : line.product.name,
    productSlug: line.product.slug,
    variantKey: line.variantKey,
    unitPrice: line.product.price,
    quantity: line.quantity,
    lineTotal: lineTotals[i],
  }));

  const subtotalCents = pricedItems.reduce((sum, i) => sum + toCents(i.lineTotal), 0);
  const fullCents = pricedItems.reduce((sum, i) => sum + toCents(i.unitPrice) * i.quantity, 0);
  const shippingCents = merged.reduce((sum, l) => sum + toCents(l.product.shippingTax) * l.quantity, 0);
  return {
    ok: true,
    priced: {
      items: pricedItems,
      unitsByProduct,
      totals: {
        subtotal: subtotalCents / 100,
        shippingCost: shippingCents / 100,
        total: (subtotalCents + shippingCents) / 100,
        savings: Math.max(0, fullCents - subtotalCents) / 100,
      },
    },
  };
}

/** The same lines whatever order the browser sent them in. */
const signatureOf = (items: { productId: string | null; variantKey: string | null; quantity: number }[]) =>
  items
    .map((i) => `${i.productId}:${i.variantKey ?? ""}:${i.quantity}`)
    .sort()
    .join("|");

class OutOfStock extends Error {}

/**
 * Saves a cash-on-delivery order and takes its pieces out of stock. A second
 * submit of the same cart from the same phone within ten minutes returns the
 * first order instead of making another.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const phone = parseMoroccanPhone(input.details.phone);
  if (!phone) return { success: false, error: "validation.phone", fields: { phone: "validation.phone" } };

  const pricing = await priceCart(input.items);
  if (!pricing.ok) return pricing.failure;
  const { items, totals, unitsByProduct } = pricing.priced;
  const clientIp = input.attribution?.clientIp ?? null;
  const now = Date.now();

  const recent = await prisma.order.findMany({
    where: { phone: phone.national, paymentMethod: "cod", createdAt: { gt: new Date(now - 24 * 60 * 60 * 1000) } },
    select: { id: true, status: true, total: true, createdAt: true, subtotal: true, shippingCost: true, items: { select: { productId: true, variantKey: true, quantity: true } } },
    orderBy: { createdAt: "desc" },
  });
  const signature = signatureOf(items);
  const twin = recent.find((o) => o.status === "PENDING" && now - o.createdAt.getTime() < DUPLICATE_WINDOW_MS && signatureOf(o.items) === signature);
  if (twin) {
    return { success: true, orderId: twin.id, orderReference: orderReferenceOf(twin.id), totals: { ...totals, subtotal: twin.subtotal, shippingCost: twin.shippingCost, total: twin.total }, duplicate: true };
  }
  if (recent.length >= MAX_ORDERS_PER_PHONE_PER_DAY) return { success: false, error: "order.errorTooMany" };
  if (clientIp) {
    const fromIp = await prisma.order.count({ where: { clientIp, paymentMethod: "cod", createdAt: { gt: new Date(now - 60 * 60 * 1000) } } });
    if (fromIp >= MAX_ORDERS_PER_IP_PER_HOUR) return { success: false, error: "order.errorTooMany" };
  }

  const { details, attribution } = input;
  try {
    const order = await prisma.$transaction(async (tx) => {
      for (const [productId, units] of unitsByProduct) {
        // Only succeeds while that many are still there: two customers can't both take the last piece
        const taken = await tx.product.updateMany({ where: { id: productId, stock: { gte: units } }, data: { stock: { decrement: units } } });
        if (taken.count !== 1) throw new OutOfStock();
      }
      return tx.order.create({
        data: {
          customerName: details.fullName,
          phone: phone.national,
          city: details.city,
          location: `${details.address}, ${details.city}`,
          shippingAddress: { address1: details.address, city: details.city, country: "MA" },
          status: "PENDING",
          subtotal: totals.subtotal,
          shippingCost: totals.shippingCost,
          total: totals.total,
          currency: "MAD",
          locale: input.locale,
          paymentMethod: "cod",
          paymentStatus: "unpaid",
          stockHeld: true,
          clientIp,
          ...(attribution && {
            utmSource: attribution.utm_source ?? null,
            utmMedium: attribution.utm_medium ?? null,
            utmCampaign: attribution.utm_campaign ?? null,
            utmContent: attribution.utm_content ?? null,
            utmTerm: attribution.utm_term ?? null,
            fbclid: attribution.fbclid ?? null,
            attribution: { ...attribution },
          }),
          items: { create: items.map((item) => ({ ...item })) },
        },
        select: { id: true },
      });
    });
    return { success: true, orderId: order.id, orderReference: orderReferenceOf(order.id), totals, duplicate: false };
  } catch (err) {
    if (err instanceof OutOfStock) return { success: false, error: "order.errorNotEnough" };
    throw err;
  }
}
