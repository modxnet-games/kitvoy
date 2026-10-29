import { prisma } from "@/lib/db";
import {
  validateStockForCheckout,
  type StockValidationItem,
} from "@/lib/stock";
import type { ProductDisplay } from "@/types/product";
import { getLineTotal } from "@/lib/bundles";
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
}

export type CreateOrderResult =
  | { success: true; orderId: string; orderReference: string }
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

export async function createOrder(input: CreateOrderInput): Promise<CreateOrderResult> {
  const stockItems: StockValidationItem[] = input.items.map((i) => ({
    productId: i.product.id,
    productName: i.product.name,
    quantity: i.quantity,
  }));

  const stockValidation = await validateStockForCheckout(stockItems);
  if (!stockValidation.valid && stockValidation.errorKey) {
    return {
      success: false,
      error: stockValidation.errorKey,
      errorKey: stockValidation.errorKey,
    };
  }

  const productIds = Array.from(new Set(input.items.map((i) => i.product.id)));
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true, slug: true, price: true, shippingTax: true },
  });
  const productMap = new Map(products.map((p) => [p.id, p]));

  const pricedItems: Array<{
    productId: string;
    productName: string;
    productSlug: string;
    unitPrice: number;
    shippingTax: number;
    quantity: number;
    lineTotal: number;
  }> = [];
  for (const item of input.items) {
    const product = productMap.get(item.product.id);
    if (!product) {
      return { success: false, error: "Product not found" };
    }
    pricedItems.push({
      productId: product.id,
      productName: product.name,
      productSlug: product.slug,
      unitPrice: product.price,
      shippingTax: product.shippingTax,
      quantity: item.quantity,
      lineTotal: getLineTotal(product.price, item.quantity),
    });
  }

  const subtotal = pricedItems.reduce((sum, i) => sum + i.lineTotal, 0);
  const shippingCost = pricedItems.reduce(
    (sum, i) => sum + i.shippingTax * i.quantity,
    0,
  );
  const total = subtotal + shippingCost;

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
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

    for (const item of pricedItems) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity,
          },
        },
      });
    }

    return created;
  });

  const orderReference = `KTV-${order.id.slice(-8).toUpperCase()}`;

  // Trigger Expo Push Notification to all registered Admin Devices (non-blocking)
  (prisma as any).adminDevice.findMany({ select: { token: true } })
    .then(async (devices: any[]) => {
      if (devices.length === 0) return;
      const tokens = devices.map((d: any) => d.token);
      
      const message = {
        to: tokens,
        sound: 'madilik_notification',
        title: '💸 New Order!',
        body: `${orderReference} • ${input.customerName}\nTotal: $${total.toFixed(2)}`,
        data: { orderId: order.id },
      };

      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Accept-encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    })
    .catch((err: any) => console.error('[PushNotification] Delivery failed:', err));

  return {
    success: true,
    orderId: order.id,
    orderReference,
  };
}
