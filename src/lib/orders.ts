import { prisma } from "@/lib/db";
import {
  validateStockForCheckout,
  type StockValidationItem,
} from "@/lib/stock";
import type { ProductDisplay } from "@/types/product";
import type { OrderAttribution } from "@/lib/analytics/attribution";
import { priceLines } from "@/lib/bundles";
import { countriesForCart, getCatalogProduct, getCatalogVariant, type CountryCode } from "@/config/catalog";
import { toCents, type OrderTotals } from "@/lib/payments/money";
import {
  formatAddressLine,
  isCountryCode,
  toShippingAddress,
  validateCheckoutDetails,
  type CheckoutDetails,
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
  items: CartItemPayload[];
  /** Ad attribution and Conversions API inputs read from the request (cookies, IP, user agent) */
  attribution?: OrderAttribution;
}

export type CreateOrderResult =
  | { success: true; orderId: string; orderReference: string; totals: OrderTotals }
  | { success: false; error: string; errorKey?: string };

/** A cart line as pricing reads it: the product's id, the quantity and the colour. Everything else about the product comes from the database. */
function cartLine(product: { id: string; slug: string; name: string; price: number }, quantity: number, variantKey?: string): CartItemPayload {
  return {
    product: {
      ...product,
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
  };
}

/**
 * The cart lines of a request body, in the one shape the checkout sends them.
 * Anything malformed is dropped; the prices here are the browser's and are
 * never used (the cart is priced from the database).
 */
export function parseCartItems(input: unknown): CartItemPayload[] {
  if (!Array.isArray(input)) return [];
  const items: CartItemPayload[] = [];
  for (const item of input) {
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

    items.push(cartLine({ id, slug, name, price }, quantity, variantKey));
  }

  return items;
}

/** Details that passed the checkout's rules, as the order they become. */
export function orderInputFromDetails(details: CheckoutDetails, items: CartItemPayload[]): CreateOrderInput {
  return {
    customerName: details.fullName,
    email: details.email.toLowerCase(),
    phone: details.phone,
    shippingAddress: toShippingAddress(details),
    items,
  };
}

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
    state: str(body.state),
    zip: str(body.zip),
  };
  // A checkout page loaded before the store shipped abroad sends no country: that is a US order
  const country = str(body.country).toUpperCase() || "US";
  if (!isCountryCode(country)) {
    return { valid: false, error: "validation.country" };
  }
  details.country = country;
  // US states are two-letter codes; a region typed elsewhere keeps its own spelling
  if (country === "US") details.state = details.state.toUpperCase();

  const firstError = Object.values(validateCheckoutDetails(details))[0];
  if (firstError) {
    return { valid: false, error: firstError };
  }

  const items = parseCartItems(body.items);
  if (items.length === 0) {
    return { valid: false, error: "EMPTY_CART" };
  }

  return { valid: true, data: orderInputFromDetails(details, items) };
}

export type PricedItem = {
  productId: string;
  productName: string;
  productSlug: string;
  variantKey: string | null;
  unitPrice: number;
  shippingTax: number;
  quantity: number;
  lineTotal: number;
};

export type PricedOrder = { items: PricedItem[]; subtotal: number; shippingCost: number; total: number };

type OrderFailure = { success: false; error: string; errorKey?: string };

const failed = (error: string, errorKey?: string) => ({ ok: false as const, failure: { success: false as const, error, ...(errorKey && { errorKey }) } });

type CartProduct = { id: string; name: string; slug: string; price: number; shippingTax: number };
type CartLine = { product: CartProduct; variantKey: string | null; variantLabel: string | null; quantity: number };

/**
 * The cart as the database knows it: one line per product and colour, with
 * colours checked against the catalog, and the countries every product in it
 * ships to. Nothing the browser sent about a product is used beyond its id.
 */
async function readCartLines(items: CartItemPayload[]): Promise<{ ok: true; lines: CartLine[]; allowedCountries: CountryCode[] } | { ok: false; failure: OrderFailure }> {
  const productIds = Array.from(new Set(items.map((i) => i.product.id)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, slug: true, price: true, shippingTax: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  // One line per product and colour, however the browser split them
  const lines = new Map<string, CartLine>();
  for (const item of items) {
    const product = productMap.get(item.product.id);
    if (!product) return failed("Product not found");

    const entry = getCatalogProduct(product.slug);
    let variantKey: string | null = null;
    let variantLabel: string | null = null;
    if (entry?.hasColourChoice) {
      const variant = getCatalogVariant(product.slug, item.variantKey);
      if (!item.variantKey || !variant) return failed("order.errorChooseColour", "order.errorChooseColour");
      variantKey = variant.key;
      variantLabel = variant.label;
    }

    const key = `${product.id}:${variantKey ?? ""}`;
    const line = lines.get(key);
    if (line) line.quantity += item.quantity;
    else lines.set(key, { product, variantKey, variantLabel, quantity: item.quantity });
  }
  const merged = [...lines.values()];
  return { ok: true, lines: merged, allowedCountries: countriesForCart(merged.map((l) => l.product.slug)) };
}

/** Checks stock and prices the lines; a product bought in several colours is priced as one bundle. */
async function priceCartLines(merged: CartLine[]): Promise<{ ok: true; priced: PricedOrder } | { ok: false; failure: OrderFailure }> {
  // Stock is kept per product, so a product's colours are counted together
  const perProduct = new Map<string, StockValidationItem>();
  for (const line of merged) {
    const current = perProduct.get(line.product.id);
    if (current) current.quantity += line.quantity;
    else perProduct.set(line.product.id, { productId: line.product.id, productName: line.product.name, quantity: line.quantity });
  }
  const stockValidation = await validateStockForCheckout([...perProduct.values()]);
  if (!stockValidation.valid && stockValidation.errorKey) {
    return failed(stockValidation.errorKey, stockValidation.errorKey);
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

  // Work in cents so the stored total is exact
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

/**
 * Checks stock and prices the cart from the database, never from what the
 * browser sent. Colours are checked against the catalog, the shipping country
 * against the countries every product in the cart ships to, and a product
 * bought in several colours is priced as one bundle.
 */
async function priceOrder(input: CreateOrderInput): Promise<{ ok: true; priced: PricedOrder } | { ok: false; failure: OrderFailure }> {
  const cart = await readCartLines(input.items);
  if (!cart.ok) return cart;
  if (!cart.allowedCountries.includes(input.shippingAddress.country)) {
    return failed("order.errorCountryUnavailable", "order.errorCountryUnavailable");
  }
  return priceCartLines(cart.lines);
}

const orderReferenceOf = (id: string) => `KTV-${id.slice(-8).toUpperCase()}`;

/**
 * Saves the checkout as a pending, unpaid order. Stock is checked when the
 * cart is priced, but nothing here takes the items out of stock.
 */
export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const pricing = await priceOrder(input);
  if (!pricing.ok) return pricing.failure;
  const { items: pricedItems, subtotal, shippingCost, total } = pricing.priced;

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
      paymentStatus: "unpaid",
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
