"use client";

import Link from "next/link";
import { useLanguage } from "@/contexts/language-context";
import { logoutAction } from "@/app/login/actions";
import { normalizeMediaSrc } from "@/lib/media-url";

interface AccountContentProps {
  customer: { fullName: string; email: string; image?: string | null };
}

export function AccountContent({ customer }: AccountContentProps) {
  const { t } = useLanguage();

  const avatarSrc = customer.image ? normalizeMediaSrc(customer.image) : "";

  return (
    <div className="container px-4 py-12">
      <div className="mx-auto max-w-2xl space-y-8">
        <div className="flex items-start gap-4">
          <div className="flex size-14 items-center justify-center rounded-full border bg-card overflow-hidden">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={avatarSrc}
                alt={customer.fullName}
                className="size-14 rounded-full object-cover"
              />
            ) : (
              <span className="text-lg font-semibold text-muted-foreground">
                {customer.fullName.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight">
              {t("auth.account.title")}
            </h1>
            <p className="mt-1 text-muted-foreground">
              {t("auth.account.welcome", { name: customer.fullName })}
            </p>
          </div>
        </div>

        <div className="rounded-xl border bg-card p-6 space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">
                {t("auth.account.email")}
              </p>
              <p className="break-words text-sm font-medium">{customer.email}</p>
            </div>
            <div className="flex flex-wrap items-center gap-3 md:justify-end">
              <Link
                href="/account/orders"
                className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
              >
                {t("account.orders.title")}
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
                >
                  {t("auth.account.logout")}
                </button>
              </form>
            </div>
          </div>

          <div className="rounded-lg bg-muted/20 p-4 text-sm text-muted-foreground">
            {t("account.orders.subtitle")}
          </div>
        </div>
      </div>
    </div>
  );
}
