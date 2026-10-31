import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/auth/customer-session";
import { LoginPageClient } from "./login-page-client";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };

const DEFAULT_REDIRECT = "/shop";

export default async function LoginPage({
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

  return <LoginPageClient redirectUrl={redirectUrl} />;
}
