"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

import { landingConfig } from "@/config/landing";
import { Price } from "@/components/storefront";
import type { ProductDisplay } from "@/types/product";
import { useBuyBundle } from "./use-buy-bundle";

/** Slides up once the hero CTA has scrolled out of view. */
export function StickyBuyBar({ product }: { product: ProductDisplay | null }) {
  const [visible, setVisible] = useState(false);
  const buy = useBuyBundle(product);
  const price = product?.price ?? landingConfig.fallback.price;
  const name = product?.name ?? landingConfig.fallback.name;
  const soldOut = product !== null && product.stock <= 0;

  useEffect(() => {
    const cta = document.getElementById("hero-cta");
    if (!cta) return;
    const io = new IntersectionObserver(([entry]) => {
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(cta);
    return () => io.disconnect();
  }, []);

  return (
    <AnimatePresence>
      {visible && !soldOut && (
        <motion.div
          initial={{ y: "110%" }}
          animate={{ y: 0 }}
          exit={{ y: "110%" }}
          transition={{ type: "spring", stiffness: 260, damping: 28 }}
          className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#0b1220]/90 text-white backdrop-blur-xl"
        >
          <div className="container mx-auto flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="text-xs text-slate-400">
                <Price value={price} className="font-bold text-white" /> · Free US shipping
              </p>
            </div>
            <button
              type="button"
              onClick={() => buy(1)}
              className="shrink-0 rounded-xl bg-brand px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-orange-500"
            >
              {landingConfig.hero.cta}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
