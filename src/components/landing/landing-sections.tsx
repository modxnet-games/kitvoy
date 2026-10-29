"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BatteryCharging, Flashlight, Gauge, Package, Plus, ShieldCheck } from "lucide-react";

import { landingConfig } from "@/config/landing";
import type { ProductDisplay } from "@/types/product";
import { MagneticButton } from "./magnetic-button";
import { TiltCard } from "./tilt-card";
import { useBuyBundle } from "./use-buy-bundle";

const BENEFIT_ICONS = [Gauge, Package, BatteryCharging, Flashlight];

function SectionTitle({ title, subtitle, dark = false }: { title: string; subtitle?: string; dark?: boolean }) {
  return (
    <div className="mx-auto max-w-2xl text-center">
      <h2 data-reveal className="text-balance text-3xl font-black tracking-tight sm:text-5xl">
        {title}
      </h2>
      {subtitle && (
        <p data-reveal className={dark ? "mt-4 text-slate-400" : "mt-4 text-muted-foreground"}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

export function TrustMarquee() {
  const items = [...landingConfig.trust, ...landingConfig.trust];
  return (
    <section aria-label="Store guarantees" className="overflow-hidden border-y border-orange-600 bg-brand py-3 text-white">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap text-sm font-bold uppercase tracking-[0.15em]">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-10" aria-hidden={i >= landingConfig.trust.length}>
            {item}
            <span className="size-1.5 rounded-full bg-white/70" />
          </span>
        ))}
      </div>
    </section>
  );
}

export function Benefits() {
  const { benefits } = landingConfig;
  return (
    <section className="container mx-auto px-4 py-20 md:py-28">
      <SectionTitle title={benefits.title} />
      <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {benefits.items.map((b, i) => {
          const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length];
          return (
            <TiltCard key={b.title} data-reveal className="rounded-3xl border bg-card p-7 shadow-sm">
              <span className="flex size-12 items-center justify-center rounded-2xl bg-brand/10 text-brand">
                <Icon className="size-6" />
              </span>
              <h3 className="mt-5 text-lg font-bold">{b.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{b.text}</p>
            </TiltCard>
          );
        })}
      </div>
    </section>
  );
}

export function Faq() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <section className="container mx-auto max-w-3xl px-4 py-20 md:py-28">
      <SectionTitle title="Questions before you buy" />
      <div className="mt-10 space-y-3">
        {landingConfig.faq.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={item.q} data-reveal className="overflow-hidden rounded-2xl border bg-card">
              <button
                type="button"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold"
              >
                {item.q}
                <motion.span animate={{ rotate: isOpen ? 45 : 0 }} className="shrink-0 text-brand">
                  <Plus className="size-5" />
                </motion.span>
              </button>
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
                  >
                    <p className="px-5 pb-5 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function FinalCta({ product }: { product: ProductDisplay | null }) {
  const { finalCta } = landingConfig;
  const buy = useBuyBundle(product);
  const soldOut = product !== null && product.stock <= 0;
  return (
    <section className="relative overflow-hidden bg-[#05080f] py-24 text-white md:py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[50vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-[140px] animate-glow" />
      <div className="container relative mx-auto max-w-3xl px-4 text-center">
        <h2 data-reveal className="text-balance text-4xl font-black tracking-tight sm:text-6xl">
          {finalCta.title}
        </h2>
        <p data-reveal className="mx-auto mt-5 max-w-xl text-lg text-slate-300">
          {finalCta.subtitle}
        </p>
        <div data-reveal className="mx-auto mt-10 max-w-sm">
          <MagneticButton onClick={() => buy(1)} disabled={soldOut}>
            {soldOut ? "Sold out" : finalCta.cta}
          </MagneticButton>
        </div>
        <p data-reveal className="mt-5 flex items-center justify-center gap-2 text-sm text-slate-400">
          <ShieldCheck className="size-4 text-brand" />
          30-day money-back guarantee · Free US shipping
        </p>
      </div>
    </section>
  );
}
