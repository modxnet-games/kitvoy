import { notFound } from "next/navigation";
import { getCustomer } from "@/lib/auth/customer-session";
import { redirect } from "next/navigation";
import {
  getOrderByIdForCustomer,
  formatOrderReference,
} from "@/lib/data/customer-orders";
import { AccountOrderDetailClient } from "./account-order-detail-client";

interface AccountOrderPageProps {
  params: Promise<{ id: string }>;
}

export default async function AccountOrderDetailPage({
  params,
}: AccountOrderPageProps) {
  const customer = await getCustomer();
  if (!customer) {
    redirect("/login?redirect=/account/orders");
  }

  const { id } = await params;
  const order = await getOrderByIdForCustomer(id, customer.userId);

  if (!order) notFound();

  const reference = formatOrderReference(order.id);

  return (
    <AccountOrderDetailClient
      order={{
        ...order,
        reference,
      }}
    />
  );
}
