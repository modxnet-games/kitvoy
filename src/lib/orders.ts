import { prisma } from "@/lib/db";
import {
  validateStockForCheckout,
  type StockValidationItem,
} from "@/lib/stock";
import type { ProductDisplay } from "@/types/product";
import type { OrderAttribution } from "@/lib/analytics/attribution";
import { getLineTotal } from "@/lib/bundles";
import { toCents, type OrderTotals } from "@/lib/payments/money";
import {
  formatAddressLine,
  toShippingAddress,
  validateCheckoutDetails,
  type CheckoutDetails,
  type PaymentMethod,
  type ShippingAddress,
} from "@/lib/us-address";

export interface CartItemPayload {
  product: ProductDisplay;
  quantity: number;
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
  unitPrice: number;
  shippingTax: number;
  quantity: number;
  lineTotal: number;
};

type PricedOrder = { items: PricedItem[]; subtotal: number; shippingCost: number; total: number };

type OrderFailure = { success: false; error: string; errorKey?: string };

/** Checks stock and prices the cart from the database, never from what the browser sent. */
async function priceOrder(input: CreateOrderInput): Promise<{ ok: true; priced: PricedOrder } | { ok: false; failure: OrderFailure }> {
  const stockItems: StockValidationItem[] = input.items.map((i) => ({
    productId: i.product.id,
    productName: i.product.name,
    quantity: i.quantity,
  }));

  const stockValidation = await validateStockForCheckout(stockItems);
  if (!stockValidation.valid && stockValidation.errorKey) {
    return { ok: false, failure: { success: false, error: stockValidation.errorKey, errorKey: stockValidation.errorKey } };
  }

  const productIds = Array.from(new Set(input.items.map((i) => i.product.id)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, slug: true, price: true, shippingTax: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const items: PricedItem[] = [];
  for (const item of input.items) {
    const product = productMap.get(item.product.id);
    if (!product) {
      return { ok: false, failure: { success: false, error: "Product not found" } };
    }
    items.push({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      unitPrice: product.price,
      shippingTax: product.shippingTax,
      quantity: item.quantity,
      lineTotal: getLineTotal(product.price, item.quantity),
    });
  }

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
export function orderLinesKey(lines: { productId: string | null; quantity: number; unitPrice: number }[]): string {
  return lines
    .map((l) => `${l.productId ?? ""}x${l.quantity}@${toCents(l.unitPrice)}`)
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
    items: { productId: string | null; quantity: number; unitPrice: number }[];
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
