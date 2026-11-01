import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCustomer } from "@/lib/auth/customer-session";
import { googleErrorCode, safeRedirectPath } from "@/lib/auth/google-oauth";
import { LoginPageClient } from "./login-page-client";

export const metadata: Metadata = { title: "Sign in", robots: { index: false, follow: true } };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string; error?: string }>;
}) {
  const { redirect: redirectTo, error } = await searchParams;
  const redirectUrl = safeRedirectPath(redirectTo);

  if (await getCustomer()) redirect(redirectUrl);

  return <LoginPageClient redirectUrl={redirectUrl} googleError={googleErrorCode(error)} />;
}
