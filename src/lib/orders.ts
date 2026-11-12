import { prisma } from "@/lib/db";
import {
  validateStockForCheckout,
  type StockValidationItem,
} from "@/lib/stock";
import type { ProductDisplay } from "@/types/product";
import type { OrderAttribution } from "@/lib/analytics/attribution";
import { priceLines } from "@/lib/bundles";
import { countriesForCart, getCatalogProduct, getCatalogVariant } from "@/config/catalog";
import { toCents, type OrderTotals } from "@/lib/payments/money";
import {
  formatAddressLine,
  isCountryCode,
  toShippingAddress,
  validateCheckoutDetails,
  type CheckoutDetails,
  type PaymentMethod,
  type ShippingAddress,
} from "@/lib/us-address";

export interface CartItemPayload {
  product: ProductDisplay;
  quantity: number;
  /** The colour picked, for products sold in several (config/catalog.ts) */
  variantKey?: string;
}

export interface CreateOrderInput {
  customerName: string;
  email: string;
  phone: string;
  shippingAddress: ShippingAddress;
  paymentMethod: PaymentMethod;
  items: CartItemPayload[];
  /** When set, links the order to the authenticated customer. */
  userId?: string;
  /** Ad attribution and Conversions API inputs read from the request (cookies, IP, user agent) */
  attribution?: OrderAttribution;
}

export type CreateOrderResult =
  | { success: true; orderId: string; orderReference: string; totals: OrderTotals }
  | { success: false; error: string; errorKey?: string };

export function validateOrderInput(input: unknown): { valid: false; error: string } | { valid: true; data: CreateOrderInput } {
  if (!input || typeof input !== "object") {
    return { valid: false, error: "Invalid request body" };
  }

  const body = input as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const details: CheckoutDetails = {
    email: str(body.email),
    fullName: str(body.fullName),
    phone: str(body.phone),
    address1: str(body.address1),
    address2: str(body.address2),
    city: str(body.city),
    state: str(body.state).toUpperCase(),
    zip: str(body.zip),
    paymentMethod: body.paymentMethod === "paypal" ? "paypal" : "card",
  };
  // A checkout page loaded before the store shipped abroad sends no country: that is a US order
  const country = str(body.country).toUpperCase() || "US";
  if (!isCountryCode(country)) {
    return { valid: false, error: "validation.country" };
  }
  details.country = country;

  const firstError = Object.values(validateCheckoutDetails(details))[0];
  if (firstError) {
    return { valid: false, error: firstError };
  }

  if (!Array.isArray(body.items) || body.items.length === 0) {
    return { valid: false, error: "EMPTY_CART" };
  }

  const items: CartItemPayload[] = [];
  for (const item of body.items) {
    if (!item || typeof item !== "object") continue;
    const it = item as Record<string, unknown>;
    const product = it.product;
    const quantity = typeof it.quantity === "number" ? Math.floor(it.quantity) : 0;
    if (!product || typeof product !== "object" || quantity <= 0) continue;

    const p = product as Record<string, unknown>;
    const id = typeof p.id === "string" ? p.id : "";
    const slug = typeof p.slug === "string" ? p.slug : "";
    const name = typeof p.name === "string" ? p.name : "";
    const price = typeof p.price === "number" ? p.price : 0;
    const variant = p.variant && typeof p.variant === "object" ? (p.variant as Record<string, unknown>).key : undefined;
    const rawVariantKey = typeof it.variantKey === "string" ? it.variantKey : typeof variant === "string" ? variant : "";
    const variantKey = /^[a-z0-9-]{1,40}$/.test(rawVariantKey) ? rawVariantKey : undefined;

    if (!id || !name || !slug || price <= 0) continue;

    items.push({
      product: {
        id,
        slug,
        name,
        price,
        shortDescription: "",
        description: "",
        details: "",
        rating: 0,
        reviewCount: 0,
        stock: 999,
        sku: "",
        isFeatured: false,
        category: { id: "", name: "", slug: "" },
        images: [],
      } as ProductDisplay,
      quantity,
      ...(variantKey && { variantKey }),
    });
  }

  if (items.length === 0) {
    return { valid: false, error: "EMPTY_CART" };
  }

  return {
    valid: true,
    data: {
      customerName: details.fullName,
      email: details.email.toLowerCase(),
      phone: details.phone,
      shippingAddress: toShippingAddress(details),
      paymentMethod: details.paymentMethod,
      items,
    },
  };
}

type PricedItem = {
  productId: string;
  productName: string;
  productSlug: string;
  variantKey: string | null;
  unitPrice: number;
  shippingTax: number;
  quantity: number;
  lineTotal: number;
};

type PricedOrder = { items: PricedItem[]; subtotal: number; shippingCost: number; total: number };

type OrderFailure = { success: false; error: string; errorKey?: string };

/**
 * Checks stock and prices the cart from the database, never from what the
 * browser sent. Colours are checked against the catalog, the shipping country
 * against the countries every product in the cart ships to, and a product
 * bought in several colours is priced as one bundle.
 */
async function priceOrder(input: CreateOrderInput): Promise<{ ok: true; priced: PricedOrder } | { ok: false; failure: OrderFailure }> {
  const fail = (error: string, errorKey?: string) => ({ ok: false as const, failure: { success: false as const, error, ...(errorKey && { errorKey }) } });

  const productIds = Array.from(new Set(input.items.map((i) => i.product.id)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, slug: true, price: true, shippingTax: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // One line per product and colour, however the browser split them
  const lines = new Map<string, { product: (typeof products)[number]; variantKey: string | null; variantLabel: string | null; quantity: number }>();
  for (const item of input.items) {
    const product = productMap.get(item.product.id);
    if (!product) return fail("Product not found");

    const entry = getCatalogProduct(product.slug);
    let variantKey: string | null = null;
    let variantLabel: string | null = null;
    if (entry?.hasColourChoice) {
      const variant = getCatalogVariant(product.slug, item.variantKey);
      if (!item.variantKey || !variant) return fail("order.errorChooseColour", "order.errorChooseColour");
      variantKey = variant.key;
      variantLabel = variant.label;
    }

    const key = `${product.id}:${variantKey ?? ""}`;
    const line = lines.get(key);
    if (line) line.quantity += item.quantity;
    else lines.set(key, { product, variantKey, variantLabel, quantity: item.quantity });
  }
  const merged = [...lines.values()];

  const allowed = countriesForCart(merged.map((l) => l.product.slug));
  if (!allowed.includes(input.shippingAddress.country)) {
    return fail("order.errorCountryUnavailable", "order.errorCountryUnavailable");
  }

  // Stock is kept per product, so a product's colours are counted together
  const perProduct = new Map<string, StockValidationItem>();
  for (const line of merged) {
    const current = perProduct.get(line.product.id);
    if (current) current.quantity += line.quantity;
    else perProduct.set(line.product.id, { productId: line.product.id, productName: line.product.name, quantity: line.quantity });
  }
  const stockValidation = await validateStockForCheckout([...perProduct.values()]);
  if (!stockValidation.valid && stockValidation.errorKey) {
    return fail(stockValidation.errorKey, stockValidation.errorKey);
  }

  const totals = priceLines(merged.map((l) => ({ productId: l.product.id, slug: l.product.slug, unitPrice: l.product.price, quantity: l.quantity })));
  const items: PricedItem[] = merged.map((line, i) => ({
    productId: line.product.id,
    // The colour is part of the name wherever the order is read: emails, admin, packing slip
    productName: line.variantLabel ? `${line.product.name} (${line.variantLabel})` : line.product.name,
    productSlug: line.product.slug,
    variantKey: line.variantKey,
    unitPrice: line.product.price,
    shippingTax: line.product.shippingTax,
    quantity: line.quantity,
    lineTotal: totals[i],
  }));

  // Work in cents so the stored total is exactly what Stripe and PayPal charge
  const subtotalCents = items.reduce((sum, i) => sum + toCents(i.lineTotal), 0);
  const shippingCents = items.reduce((sum, i) => sum + toCents(i.shippingTax * i.quantity), 0);
  return {
    ok: true,
    priced: {
      items,
      subtotal: subtotalCents / 100,
      shippingCost: shippingCents / 100,
      total: (subtotalCents + shippingCents) / 100,
    },
  };
}

const orderReferenceOf = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const pricing = await priceOrder(input);
  if (!pricing.ok) return pricing.failure;
  const { items: pricedItems, subtotal, shippingCost, total } = pricing.priced;

  // Stock is reserved when the payment is captured (see completePaidOrder),
  // so abandoned checkouts don't drain inventory.
  const order = await prisma.order.create({
    data: {
      customerName: input.customerName,
      email: input.email,
      phone: input.phone,
      location: formatAddressLine(input.shippingAddress),
      shippingAddress: { ...input.shippingAddress },
      status: "PENDING",
      subtotal,
      shippingCost,
      total,
      currency: "USD",
      locale: "en",
      paymentMethod: input.paymentMethod,
      paymentStatus: "unpaid",
      ...(input.userId && { userId: input.userId }),
      ...(input.attribution && {
        utmSource: input.attribution.utm_source ?? null,
        utmMedium: input.attribution.utm_medium ?? null,
        utmCampaign: input.attribution.utm_campaign ?? null,
        utmContent: input.attribution.utm_content ?? null,
        utmTerm: input.attribution.utm_term ?? null,
        fbclid: input.attribution.fbclid ?? null,
        attribution: { ...input.attribution },
      }),
      items: {
        create: pricedItems.map((item) => ({
          productId: item.productId,
          productName: item.productName,
          productSlug: item.productSlug,
          variantKey: item.variantKey,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
      },
    },
    include: { items: true },
  });

  return {
    success: true,
    orderId: order.id,
    orderReference: orderReferenceOf(order.id),
    totals: { subtotal, shippingCost, total },
  };
}

/** The lines of an order as one comparable string, whatever order they were saved in. */
export function orderLinesKey(lines: { productId: string | null; variantKey?: string | null; quantity: number; unitPrice: number }[]): string {
  return lines
    .map((l) => `${l.productId ?? ""}${l.variantKey ? `:${l.variantKey}` : ""}x${l.quantity}@${toCents(l.unitPrice)}`)
    .sort()
    .join(",");
}

export type UpdateOrderResult =
  | { success: true; orderId: string; orderReference: string; totals: OrderTotals; totalChanged: boolean; detailsChanged: boolean }
  | { success: false; error: string; errorKey?: string; notReusable?: boolean };

/**
 * Saves new details (and a changed cart) on the open order of a checkout that
 * was already started, so a reload, the Edit button or a retry never leaves a
 * second order behind. Only an order that is still PENDING and unpaid is
 * touched; the write re-checks that, so a payment landing at the same moment
 * wins and the caller creates a new order instead (`notReusable`).
 */
export async function updatePendingOrder(
  existing: {
    id: string;
    total: number;
    customerName: string;
    email: string | null;
    phone: string;
    location: string;
    attribution: unknown;
    items: { productId: string | null; variantKey?: string | null; quantity: number; unitPrice: number }[];
  },
  input: CreateOrderInput,
): Promise<UpdateOrderResult> {
  const pricing = await priceOrder(input);
  if (!pricing.ok) return pricing.failure;
  const { items: pricedItems, subtotal, shippingCost, total } = pricing.priced;

  const location = formatAddressLine(input.shippingAddress);
  const itemsChanged = orderLinesKey(existing.items) !== orderLinesKey(pricedItems);
  const totalChanged = toCents(existing.total) !== toCents(total);
  const detailsChanged =
    existing.customerName !== input.customerName ||
    (existing.email ?? "") !== input.email ||
    existing.phone !== input.phone ||
    existing.location !== location;

  // The ad click and browser ids saved when the checkout started stay; a retry only fills in what was missing (fbp, fbc)
  const before = (existing.attribution ?? {}) as Record<string, unknown>;
  const merged = { ...(input.attribution ?? {}), ...before };
  const attribution = Object.keys(merged).length > Object.keys(before).length ? merged : null;

  const updated = await prisma.$transaction(async (tx) => {
    const { count } = await tx.order.updateMany({
      where: { id: existing.id, status: "PENDING", paymentStatus: "unpaid" },
      data: {
        customerName: input.customerName,
        email: input.email,
        phone: input.phone,
        location,
        shippingAddress: { ...input.shippingAddress },
        subtotal,
        shippingCost,
        total,
        ...(input.userId && { userId: input.userId }),
        ...(attribution && { attribution }),
        // A PayPal order opened for the old amount must never be captured for the new one
        ...(totalChanged && { paymentRef: null }),
      },
    });
    if (count === 0) return false;
    if (itemsChanged) {
      await tx.orderItem.deleteMany({ where: { orderId: existing.id } });
      await tx.orderItem.createMany({
        data: pricedItems.map((item) => ({
          orderId: existing.id,
          productId: item.productId,
          productName: item.productName,
          productSlug: item.productSlug,
          variantKey: item.variantKey,
          unitPrice: item.unitPrice,
          quantity: item.quantity,
          lineTotal: item.lineTotal,
        })),
      });
    }
    return true;
  });
  if (!updated) return { success: false, error: "ORDER_NOT_REUSABLE", notReusable: true };

  return {
    success: true,
    orderId: existing.id,
    orderReference: orderReferenceOf(existing.id),
    totals: { subtotal, shippingCost, total },
    totalChanged,
    detailsChanged,
  };
}
