"use client";

import { useState } from "react";
import { Check } from "lucide-react";

import { landingConfig } from "@/config/landing";
import { BUNDLE_TIERS, getBundleSavings, getLineTotal } from "@/lib/bundles";
import { Price, SectionHeading } from "@/components/storefront";
import { cn } from "@/lib/utils";
import type { ProductDisplay } from "@/types/product";
import { useBuyBundle } from "./use-buy-bundle";

interface BundleOfferProps {
  product: ProductDisplay | null;
}

export function BundleOffer({ product }: BundleOfferProps) {
  const { bundle, fallback } = landingConfig;
  const buy = useBuyBundle(product);
  const [selected, setSelected] = useState(BUNDLE_TIERS[1]?.quantity ?? 1);

  const unitPrice = product?.price ?? fallback.price;
  const maxQty = product?.stock ?? Infinity;

  return (
    <section id="bundles" className="bg-muted/30 py-12 md:py-20">
      <div className="container mx-auto max-w-4xl px-4">
        <SectionHeading title={bundle.title} subtitle={bundle.subtitle} className="text-center sm:justify-center" />

        <div role="radiogroup" className="mt-10 grid gap-4 md:grid-cols-3">
          {BUNDLE_TIERS.map((tier) => {
            const isSelected = tier.quantity === selected;
            const disabled = tier.quantity > maxQty;
            const savings = getBundleSavings(unitPrice, tier.quantity);
            return (
              <button
                key={tier.quantity}
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => setSelected(tier.quantity)}
                className={cn(
                  "relative flex flex-col items-center rounded-2xl border-2 bg-background p-6 text-center transition disabled:opacity-40",
                  isSelected ? "border-primary shadow-lg" : "border-border hover:border-primary/40",
                )}
              >
                {tier.badge && (
                  <span className="absolute -top-3 rounded-full bg-primary px-3 py-0.5 text-xs font-bold uppercase text-primary-foreground">
                    {tier.badge}
                  </span>
                )}
                <span className="text-lg font-bold">{tier.label}</span>
                <span className="text-sm text-muted-foreground">
                  {tier.quantity} {tier.quantity === 1 ? "inflator" : "inflators"}
                </span>
                <Price value={getLineTotal(unitPrice, tier.quantity)} className="mt-3 text-2xl font-black" />
                <span className="text-xs text-muted-foreground">
                  <Price value={getLineTotal(unitPrice, tier.quantity) / tier.quantity} /> each
                </span>
                {savings > 0 ? (
                  <span className="mt-3 rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 dark:bg-green-950 dark:text-green-300">
                    Save <Price value={savings} /> ({Math.round(tier.discount * 100)}% off)
                  </span>
                ) : (
                  <span className="mt-3 h-6" />
                )}
                {isSelected && (
                  <Check className="absolute right-3 top-3 size-5 text-primary" />
                )}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => buy(selected)}
          disabled={selected > maxQty}
          className="mx-auto mt-8 block w-full max-w-md rounded-xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90 disabled:opacity-50"
        >
          {bundle.cta}
        </button>
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Free US shipping on every bundle · 30-day money-back guarantee
        </p>
      </div>
    </section>
  );
}
