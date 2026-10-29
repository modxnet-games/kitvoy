import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/auth/customer-session";

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const customer = await getCustomer();
  if (!customer) {
    redirect("/login?redirect=/account");
  }

  return <>{children}</>;
}
