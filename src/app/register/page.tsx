import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/auth/customer-session";
import { safeRedirectPath } from "@/lib/auth/google-oauth";
import { RegisterPageClient } from "./register-page-client";

export const metadata: Metadata = { title: "Create account", robots: { index: false, follow: true } };

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { redirect: redirectTo } = await searchParams;
  const redirectUrl = safeRedirectPath(redirectTo);

  if (await getCustomer()) redirect(redirectUrl);

  return <RegisterPageClient redirectUrl={redirectUrl} />;
}
