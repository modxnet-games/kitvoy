import { NextResponse } from "next/server";
import { createOrder, validateOrderInput } from "@/lib/orders";
import { getCustomer } from "@/lib/auth/customer-session";
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
