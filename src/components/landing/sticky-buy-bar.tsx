"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { landingConfig } from "@/config/landing";
import { Price } from "@/components/storefront";
import type { ProductDisplay } from "@/types/product";
import { getAvailability, useBuyBundle } from "./use-buy-bundle";

/** Slides up once the hero CTA has scrolled out of view. */
export function StickyBuyBar({ product }: { product: ProductDisplay | null }) {
  const [pastHero, setPastHero] = useState(false);
  const [atFooter, setAtFooter] = useState(false);
  const buy = useBuyBundle(product);
  const price = product?.price ?? landingConfig.fallback.price;
  const name = product?.name ?? landingConfig.fallback.name;
  const { canBuy } = getAvailability(product);

  useEffect(() => {
    const cta = document.getElementById("hero-cta");
    const footer = document.querySelector("footer");
    const io = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.target === cta) {
          setPastHero(!entry.isIntersecting && entry.boundingClientRect.top < 0);
        } else {
          // The footer sits under the bar; the closing CTA above it has its own button
          setAtFooter(entry.isIntersecting);
        }
      }
    });
    if (cta) io.observe(cta);
    if (footer) io.observe(footer);
    return () => io.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {pastHero && !atFooter && canBuy && (
        <motion.div
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-ink/90 text-white backdrop-blur-xl"
        >
          <div className="container mx-auto flex items-center justify-between gap-4 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-zinc-400">
                <Price value={price} className="font-bold text-white" /> · Free US shipping
              </p>
            </div>
            <button
              type="button"
              onClick={() => buy(1)}
              className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-ink shadow-lg transition hover:bg-brand/90"
            >
              {landingConfig.hero.cta}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
