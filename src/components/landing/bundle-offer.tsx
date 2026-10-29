"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Check } from "lucide-react";

import { landingConfig } from "@/config/landing";
import { BUNDLE_TIERS, getBundleSavings, getLineTotal } from "@/lib/bundles";
import { Price } from "@/components/storefront";
import { cn } from "@/lib/utils";
import type { ProductDisplay } from "@/types/product";
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
    <section id="bundles" className="relative overflow-hidden bg-[#0b1220] py-20 text-white md:py-28">
      <div className="pointer-events-none absolute -top-40 right-0 size-[36vmax] rounded-full bg-brand/15 blur-[120px]" />
      <div className="container relative mx-auto max-w-5xl px-4">
        <div className="mx-auto max-w-2xl text-center">
          <h2 data-reveal className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
            {bundle.title}
          </h2>
          <p data-reveal className="mt-4 text-slate-400">{bundle.subtitle}</p>
        </div>

        <div role="radiogroup" aria-label="Choose a bundle" className="mt-14 grid gap-4 md:grid-cols-3">
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
                  "relative flex w-full flex-col items-center rounded-3xl border bg-white/[0.03] p-7 text-center backdrop-blur disabled:opacity-40",
                  isSelected ? "border-transparent" : "border-white/10",
                )}
              >
                {isSelected && (
                  <motion.span
                    layoutId="bundle-ring"
                    className="absolute inset-0 rounded-3xl border-2 border-brand bg-brand/10 shadow-[0_0_60px_-12px_rgba(249,115,22,0.7)]"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                {tier.badge && (
                  <span className="absolute -top-3 z-10 rounded-full bg-brand px-3 py-0.5 text-xs font-bold uppercase tracking-wide text-white">
                    {tier.badge}
                  </span>
                )}
                <span className="relative text-lg font-bold">{tier.label}</span>
                <span className="relative text-sm text-slate-400">
                  {tier.quantity} {tier.quantity === 1 ? "inflator" : "inflators"}
                </span>
                <Price value={lineTotal} className="relative mt-4 text-4xl font-black" />
                <span className="relative text-xs text-slate-400">
                  <Price value={lineTotal / tier.quantity} /> each
                </span>
                {savings > 0 ? (
                  <span className="relative mt-4 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-semibold text-emerald-300">
                    You save <Price value={savings} />
                  </span>
                ) : (
                  <span className="relative mt-4 h-6" />
                )}
                {isSelected && <Check className="absolute right-4 top-4 size-5 text-brand" />}
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
          <p className="mt-3 text-center text-xs text-slate-500">
            Free US shipping on every bundle · 30-day money-back guarantee
          </p>
        </div>
      </div>
    </section>
  );
}
