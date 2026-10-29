import { NextResponse } from "next/server";
import { createOrder, validateOrderInput } from "@/lib/orders";
import { getCustomer } from "@/lib/auth/customer-session";
import { getOrderById } from "@/lib/data/admin-orders";
import { sendOrderNotification } from "@/lib/email";
import { saveSubscriberEmail } from "@/lib/subscribers";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const validated = validateOrderInput(body);

    if (!validated.valid) {
      return NextResponse.json(
        { error: validated.error },
        { status: 400 },
      );
    }

    const customer = await getCustomer();
    const data = {
      ...validated.data,
      ...(customer && { userId: customer.userId }),
    };
    if (customer?.email) {
      await saveSubscriberEmail(customer.email, "checkout");
    }
    const result = await createOrder(data);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 },
      );
    }

    // Notify store owner by email (best-effort; do not fail the request)
    try {
      const order = await getOrderById(result.orderId);
      if (order) {
        const emailResult = await sendOrderNotification({
          id: order.id,
          orderReference: result.orderReference,
          customerName: order.customerName,
          phone: order.phone,
          location: order.location,
          items: order.items.map((i) => ({
            productName: i.productName,
            productSlug: i.productSlug,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            lineTotal: i.lineTotal,
          })),
          subtotal: order.subtotal,
          shippingCost: order.shippingCost,
          total: order.total,
          currency: order.currency,
          locale: order.locale,
          paymentMethod: order.paymentMethod,
          createdAt: order.createdAt,
        });
        if (!emailResult.sent) {
          console.warn("[orders] Order notification not sent:", emailResult.reason);
        }
      }
    } catch (emailErr) {
      console.error("[orders] Order notification error:", emailErr);
    }

    return NextResponse.json({
      orderId: result.orderId,
      orderReference: result.orderReference,
    });
  } catch (err) {
    console.error("Order creation error:", err);
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 },
    );
  }
}
