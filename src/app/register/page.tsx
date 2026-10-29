import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/auth/customer-session";
import { RegisterPageClient } from "./register-page-client";

const DEFAULT_REDIRECT = "/shop";

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const customer = await getCustomer();
  if (customer) {
    const { redirect: redirectTo } = await searchParams;
    const target = redirectTo && redirectTo.startsWith("/") ? redirectTo : DEFAULT_REDIRECT;
    redirect(target);
  }

  const { redirect: redirectTo } = await searchParams;
  const redirectUrl = redirectTo && redirectTo.startsWith("/") ? redirectTo : DEFAULT_REDIRECT;

  return <RegisterPageClient redirectUrl={redirectUrl} />;
}
