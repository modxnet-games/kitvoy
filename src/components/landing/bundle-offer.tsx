"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";

import { landingConfig } from "@/config/landing";
import { BUNDLE_TIERS, getBundleSavings, getLineTotal } from "@/lib/bundles";
import { Price } from "@/components/storefront";
import { cn } from "@/lib/utils";
import type { ProductDisplay } from "@/types/product";
import { LandingHeading } from "./landing-heading";
import { MagneticButton } from "./magnetic-button";
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
  const total = getLineTotal(unitPrice, selected);

  return (
    <section id="bundles" className="relative scroll-mt-24 overflow-hidden bg-ink py-16 text-white md:py-28">
      <div className="pointer-events-none absolute -top-40 right-0 size-[36vmax] rounded-full bg-brand/15 blur-[120px]" />
      <div className="container relative mx-auto max-w-5xl px-4">
        <LandingHeading eyebrow={bundle.eyebrow} title={bundle.title} subtitle={bundle.subtitle} tone="dark" />

        <div role="radiogroup" aria-label="Choose a bundle" className="mt-10 grid gap-5 sm:mt-14 md:grid-cols-3 md:gap-4">
          {BUNDLE_TIERS.map((tier) => {
            const isSelected = tier.quantity === selected;
            const disabled = tier.quantity > maxQty;
            const lineTotal = getLineTotal(unitPrice, tier.quantity);
            const savings = getBundleSavings(unitPrice, tier.quantity);
            return (
              <div key={tier.quantity} data-reveal className="flex">
              <motion.button
                type="button"
                role="radio"
                aria-checked={isSelected}
                disabled={disabled}
                onClick={() => setSelected(tier.quantity)}
                whileHover={disabled ? undefined : { y: -6 }}
                transition={{ type: "spring", stiffness: 300, damping: 22 }}
                className={cn(
                  "relative flex w-full items-center justify-between gap-4 rounded-2xl border bg-white/[0.03] px-5 py-5 text-left backdrop-blur disabled:opacity-40 md:flex-col md:justify-start md:rounded-3xl md:p-7 md:text-center",
                  isSelected ? "border-transparent" : "border-white/10",
                )}
              >
                {isSelected && (
                  <motion.span
                    layoutId="bundle-ring"
                    className="absolute inset-0 rounded-2xl border-2 border-brand bg-brand/10 shadow-[0_0_60px_-12px_rgba(249,115,22,0.7)] md:rounded-3xl"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {tier.badge && (
                  <span className="absolute -top-2.5 left-5 z-10 rounded-full bg-brand px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white md:-top-3 md:left-1/2 md:-translate-x-1/2 md:px-3 md:text-xs">
                    {tier.badge}
                  </span>
                )}
                <span className="relative flex items-center gap-3 md:flex-col md:gap-0">
                  <span
                    className={cn(
                      "flex size-5 shrink-0 items-center justify-center rounded-full border-2 md:hidden",
                      isSelected ? "border-brand bg-brand" : "border-white/30",
                    )}
                    aria-hidden
                  >
                    {isSelected && <Check className="size-3 text-white" strokeWidth={3} />}
                  </span>
                  <span className="flex flex-col md:items-center">
                    <span className="text-base font-bold md:text-lg">{tier.label}</span>
                    <span className="text-xs text-stone-400 md:text-sm">
                      {tier.quantity} {tier.quantity === 1 ? "inflator" : "inflators"} · <Price value={lineTotal / tier.quantity} /> each
                    </span>
                  </span>
                </span>
                <span className="relative flex flex-col items-end md:mt-4 md:items-center">
                  <Price value={lineTotal} className="text-2xl font-black md:text-4xl" />
                  {savings > 0 ? (
                    <span className="mt-1 rounded-full bg-emerald-400/15 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-300 md:mt-4 md:px-3 md:py-1 md:text-xs">
                      Save <Price value={savings} />
                    </span>
                  ) : (
                    <span className="hidden h-6 md:mt-4 md:block" />
                  )}
                </span>
                {isSelected && <Check className="absolute right-4 top-4 hidden size-5 text-brand md:block" />}
              </motion.button>
              </div>
            );
          })}
        </div>

        <div data-reveal className="mx-auto mt-10 max-w-md">
          <MagneticButton onClick={() => buy(selected)} disabled={selected > maxQty}>
            <span className="inline-flex items-center gap-2">
              {bundle.cta} ·
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.span
                  key={total}
                  initial={{ y: 14, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -14, opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Price value={total} />
                </motion.span>
              </AnimatePresence>
            </span>
          </MagneticButton>
          <p className="mt-3 text-center text-xs text-stone-500">
            Free US shipping on every bundle · 30-day money-back guarantee
          </p>
        </div>
      </div>
    </section>
  );
}
