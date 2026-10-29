"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BatteryCharging, Flashlight, Gauge, Package, Plus, ShieldCheck } from "lucide-react";

import { landingConfig } from "@/config/landing";
import type { ProductDisplay } from "@/types/product";
import { MagneticButton } from "./magnetic-button";
import { LandingHeading } from "./landing-heading";
import { TiltCard } from "./tilt-card";
import { useBuyBundle } from "./use-buy-bundle";

const BENEFIT_ICONS = [Gauge, Package, BatteryCharging, Flashlight];

export function TrustMarquee() {
  const items = [...landingConfig.trust, ...landingConfig.trust];
  return (
    <section aria-label="Store guarantees" className="overflow-hidden border-y border-brand bg-brand py-3 text-ink">
      <div className="flex w-max animate-marquee gap-10 whitespace-nowrap text-sm font-bold uppercase tracking-[0.15em]">
        {items.map((item, i) => (
          <span key={i} className="flex items-center gap-10" aria-hidden={i >= landingConfig.trust.length}>
            {item}
            <span className="size-1.5 rounded-full bg-ink/40" />
          </span>
        ))}
      </div>
    </section>
  );
}

export function Benefits() {
  const { benefits } = landingConfig;
  return (
    <section className="container mx-auto px-4 py-16 md:py-28">
      <LandingHeading eyebrow={benefits.eyebrow} title={benefits.title} />
      <div className="mt-10 grid gap-4 sm:mt-14 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
        {benefits.items.map((b, i) => {
          const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length];
          return (
            <TiltCard key={b.title} data-reveal className="rounded-3xl border bg-card p-6 shadow-[0_1px_0_rgba(255,255,255,0.5)_inset,0_10px_30px_-20px_rgba(11,11,15,0.22)] sm:p-7">
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
    <section id="faq" className="container mx-auto max-w-3xl scroll-mt-24 px-4 py-16 md:py-28">
      <LandingHeading eyebrow={landingConfig.faqHeading.eyebrow} title={landingConfig.faqHeading.title} />
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
    <section className="relative overflow-hidden bg-ink-deep py-20 text-white md:py-32">
      <div className="pointer-events-none absolute left-1/2 top-1/2 size-[50vmax] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand/20 blur-[140px] animate-glow" />
      <div className="container relative mx-auto max-w-3xl px-4 text-center">
        <h2 data-reveal className="text-balance text-[2.2rem] font-black leading-[1.05] tracking-tight sm:text-6xl">
          {finalCta.title}
        </h2>
        <p data-reveal className="mx-auto mt-5 max-w-xl text-lg text-zinc-300">
          {finalCta.subtitle}
        </p>
        <div data-reveal className="mx-auto mt-10 max-w-sm">
          <MagneticButton onClick={() => buy(1)} disabled={soldOut}>
            {soldOut ? "Sold out" : finalCta.cta}
          </MagneticButton>
        </div>
        <p data-reveal className="mt-5 flex items-center justify-center gap-2 text-sm text-zinc-400">
          <ShieldCheck className="size-4 text-brand" />
          30-day money-back guarantee · Free US shipping
        </p>
      </div>
    </section>
  );
}
