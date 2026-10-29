import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { getStoreSettings } from "@/lib/data/store-settings";
import { StoreSettingsForm } from "./store-settings-form";

export default async function StoreSettingsPage() {
  const settings = await getStoreSettings();

  return (
    <div>
      <Link
        href="/admin"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-bold tracking-tight">
        Store social &amp; contact
      </h1>
      <p className="mt-1 text-muted-foreground">
        Manage WhatsApp, social links, and basic contact details for your
        storefront.
      </p>

      <div className="mt-8">
        <StoreSettingsForm settings={settings} />
      </div>
    </div>
  );
}

