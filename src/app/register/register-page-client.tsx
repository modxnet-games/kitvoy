"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";
import { RegisterForm } from "./register-form";
import { GoogleLoginButton } from "@/app/login/google-login-button";

interface RegisterPageClientProps {
  redirectUrl: string;
}

export function RegisterPageClient({ redirectUrl }: RegisterPageClientProps) {
  const { t } = useLanguage();
  const loginHref = redirectUrl ? `/login?redirect=${encodeURIComponent(redirectUrl)}` : "/login";

  return (
    <div className="container flex min-h-[60vh] items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">
            {t("auth.register.title")}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t("auth.register.subtitle")}
          </p>
        </div>
        <GoogleLoginButton redirectUrl={redirectUrl} />
        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t("auth.login.orContinueWith") || "or continue with email"}
            </span>
          </div>
        </div>
        <RegisterForm redirectUrl={redirectUrl} />
        <p className="text-center text-sm text-muted-foreground">
          {t("auth.register.hasAccount")}{" "}
          <Link href={loginHref} className="font-medium text-primary hover:underline">
            {t("auth.register.loginLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
