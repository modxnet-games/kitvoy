"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDown, Check, ShieldCheck, Star, Truck } from "lucide-react";

import { landingConfig } from "@/config/landing";
import { Price } from "@/components/storefront";
import { cn } from "@/lib/utils";
import type { ProductDisplay } from "@/types/product";
import type { ProgressRef } from "./scene/inflator-model";
import { CountdownTimer } from "./countdown-timer";
import { MagneticButton } from "./magnetic-button";
import { useBuyBundle } from "./use-buy-bundle";
import { usePrefersReducedMotion } from "./use-reduced-motion";

gsap.registerPlugin(ScrollTrigger, useGSAP);

const InflatorCanvas = dynamic(() => import("./scene/inflator-canvas"), {
  ssr: false,
  loading: () => <SceneFallback />,
});

function SceneFallback() {
  return (
    <div className="flex size-full items-center justify-center">
      <div className="size-48 animate-pulse rounded-full bg-brand/20 blur-3xl" />
    </div>
  );
}

let webglSupport: boolean | undefined;
function hasWebGL(): boolean {
  if (webglSupport === undefined) {
    try {
      const c = document.createElement("canvas");
      webglSupport = !!(c.getContext("webgl2") || c.getContext("webgl"));
    } catch {
      webglSupport = false;
    }
  }
  return webglSupport;
}
const noopSubscribe = () => () => {};

/** Story beats are equal scroll lengths: hero, then 3 steps. Matches readoutAt() in the model. */
const STEPS_START = 1 / 6;
const STEP_SPAN = (1 - STEPS_START) / 3;
const clamp01 = (t: number) => Math.min(1, Math.max(0, t));
const stepAt = (p: number) => (p < 0.5 ? 0 : p < 5 / 6 ? 1 : 2);

interface ProductStoryProps {
  product: ProductDisplay | null;
}

/**
 * Hero + "how it works" as one pinned scroll story: the 3D inflator stays on
 * screen while four beats scroll past, and scroll progress drives its pose and
 * on-screen PSI readout.
 */
export function ProductStory({ product }: ProductStoryProps) {
  const { hero, story, countdown, fallback } = landingConfig;
  const buy = useBuyBundle(product);
  const reducedMotion = usePrefersReducedMotion();

  const section = useRef<HTMLElement>(null);
  const progress = useRef(0) as ProgressRef;
  // null on the server, so SSR markup matches the first client render
  const webgl = useSyncExternalStore<boolean | null>(noopSubscribe, hasWebGL, () => null);
  const [active, setActive] = useState(true);
  const [step, setStep] = useState(0);
  const stepsPanel = useRef<HTMLDivElement>(null);
  const trackFill = useRef<HTMLSpanElement>(null);

  const price = product?.price ?? fallback.price;
  const compareAt = product ? product.compareAtPrice : fallback.compareAtPrice;
  const soldOut = product !== null && product.stock <= 0;

  // The pinned stage starts below the sticky site header, whose height differs per breakpoint
  useEffect(() => {
    const header = document.querySelector("header");
    const el = section.current;
    if (!header || !el) return;
    const ro = new ResizeObserver(() => {
      el.style.setProperty("--header-h", `${header.getBoundingClientRect().height}px`);
      ScrollTrigger.refresh();
    });
    ro.observe(header);
    return () => ro.disconnect();
  }, []);

  // Stop rendering the scene once the story is off screen
  useEffect(() => {
    const el = section.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setActive(entry.isIntersecting), {
      rootMargin: "200px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useGSAP(
    () => {
      ScrollTrigger.create({
        trigger: section.current,
        start: () => `top top+=${section.current?.style.getPropertyValue("--header-h") || "0px"}`,
        end: "bottom bottom",
        scrub: true,
        onUpdate: (self) => {
          const p = self.progress;
          progress.current = p;
          setStep(stepAt(p));

          // Steps panel fades in as the hero copy leaves; progress fills the track
          const panel = stepsPanel.current;
          if (panel) {
            const shown = clamp01((p - STEPS_START + 0.06) / 0.08);
            panel.style.opacity = String(shown);
            panel.style.visibility = shown > 0 ? "visible" : "hidden";
            const fill = clamp01((p - STEPS_START) / (1 - STEPS_START));
            if (trackFill.current) trackFill.current.style.transform = "scaleY(" + fill + ")";
            panel.querySelectorAll<HTMLElement>("[data-seg]").forEach((seg, i) => {
              const segFill = clamp01((p - STEPS_START - i * STEP_SPAN) / STEP_SPAN);
              seg.style.transform = "scaleX(" + segFill + ")";
            });
          }
        },
      });

      if (reducedMotion) return;

      // Hero copy: staggered entrance, then drifts up and fades as step 1 arrives
      gsap.from("[data-hero-item]", {
        y: 40,
        opacity: 0,
        duration: 1,
        ease: "power3.out",
        stagger: 0.09,
        delay: 0.15,
      });
      gsap.to("[data-hero-copy]", {
        yPercent: -18,
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger: "[data-beat='0']", start: "center center", end: "bottom top", scrub: true },
      });

    },
    { scope: section, dependencies: [reducedMotion] },
  );

  return (
    <section
      ref={section}
      className="relative bg-[radial-gradient(ellipse_at_70%_40%,#1d1d27_0%,var(--ink)_55%,var(--ink-deep)_100%)] text-white"
    >
      {/* Pinned 3D stage */}
      <div className="sticky top-[var(--header-h,0px)] h-[calc(100svh-var(--header-h,0px))] overflow-hidden">
        <div className="pointer-events-none absolute right-[8%] top-1/3 size-[42vmax] rounded-full bg-brand/25 blur-[120px] animate-glow max-lg:left-1/2 max-lg:top-[8%] max-lg:-translate-x-1/2" />
        <div className="absolute inset-0">
          {webgl === false ? (
            <img
              src={product?.images[0] || "/kitvoy-icon.svg"}
              alt=""
              className="absolute right-[10%] top-1/2 w-[32vmin] -translate-y-1/2 opacity-90 max-lg:left-1/2 max-lg:top-[25%] max-lg:-translate-x-1/2"
            />
          ) : webgl ? (
            <InflatorCanvas progress={progress} eventSource={section} active={active} reducedMotion={reducedMotion} />
          ) : (
            <SceneFallback />
          )}
        </div>
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-ink-deep via-ink-deep/80 to-transparent lg:hidden" />

        {/* How it works: fixed panel, driven by scroll progress */}
        <div ref={stepsPanel} className="invisible absolute inset-0 opacity-0" aria-live="polite">
          <div className="container mx-auto flex h-full items-end px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] lg:items-center lg:pb-0">
            <div className="w-full max-w-md lg:max-w-[26rem]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-brand">How it works</p>

              {/* Desktop: vertical stepper */}
              <ol className="relative mt-7 hidden lg:block">
                <span className="absolute bottom-4 left-[17px] top-4 w-px bg-white/10" aria-hidden />
                <span
                  ref={trackFill}
                  className="absolute bottom-4 left-[17px] top-4 w-px origin-top bg-gradient-to-b from-brand to-[#FFB27A]"
                  style={{ transform: "scaleY(0)" }}
                  aria-hidden
                />
                {story.map((st, i) => {
                  const state = i < step ? "done" : i === step ? "active" : "next";
                  return (
                    <li key={st.title} className="relative flex gap-5 pb-9 last:pb-0" aria-current={state === "active" ? "step" : undefined}>
                      <span
                        className={cn(
                          "relative z-10 flex size-[35px] shrink-0 items-center justify-center rounded-full border text-sm font-bold transition-all duration-500",
                          state === "active" && "border-brand bg-brand text-ink shadow-[0_0_0_6px_rgba(255,122,26,0.15)]",
                          state === "done" && "border-brand bg-ink text-brand",
                          state === "next" && "border-white/15 bg-ink text-zinc-500",
                        )}
                      >
                        {state === "done" ? <Check className="size-4" /> : i + 1}
                      </span>
                      <div className="pt-1">
                        <h3
                          className={cn(
                            "text-xl font-bold tracking-tight transition-colors duration-500",
                            state === "active" ? "text-white" : "text-zinc-500",
                          )}
                        >
                          {st.title}
                        </h3>
                        <AnimatePresence initial={false}>
                          {state === "active" && (
                            <motion.p
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                              className="overflow-hidden text-[15px] leading-relaxed text-zinc-300"
                            >
                              <span className="block pt-2">{st.text}</span>
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>
                    </li>
                  );
                })}
              </ol>

              {/* Mobile: segmented progress + active step */}
              <div className="lg:hidden">
                <div className="mt-3 flex gap-1.5" aria-hidden>
                  {story.map((st) => (
                    <span key={st.title} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/15">
                      <span data-seg className="block h-full origin-left rounded-full bg-brand" style={{ transform: "scaleX(0)" }} />
                    </span>
                  ))}
                </div>
                <div className="relative mt-4 min-h-[8.5rem]">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <p className="text-xs font-semibold text-zinc-400">
                        Step {step + 1} of {story.length}
                      </p>
                      <h3 className="mt-1 text-[1.6rem] font-bold leading-tight tracking-tight">{story[step].title}</h3>
                      <p className="mt-2 text-[15px] leading-relaxed text-zinc-300">{story[step].text}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Scrolling beats */}
      <div className="relative -mt-[calc(100svh-var(--header-h,0px))]">
        {/* Beat 0: hero */}
        <div data-beat="0" className="container mx-auto flex min-h-[calc(100svh-var(--header-h,0px))] items-end px-4 pb-8 pt-[42svh] lg:items-center lg:py-16">
          <div data-hero-copy className="max-w-xl space-y-4 sm:space-y-5 lg:space-y-4 xl:space-y-5">
            <p data-hero-item className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand backdrop-blur">
              <span className="size-1.5 rounded-full bg-brand" />
              {hero.eyebrow}
            </p>
            <h1 data-hero-item className="text-balance text-[2.5rem] font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-[3.6rem] xl:text-7xl">
              {hero.title.split(" ").map((word, i, words) =>
                i >= words.length - 2 ? (
                  <span key={i} className="bg-gradient-to-r from-brand to-[#FFB27A] bg-clip-text text-transparent">
                    {word}{" "}
                  </span>
                ) : (
                  <span key={i}>{word} </span>
                ),
              )}
            </h1>
            <p data-hero-item className="max-w-md text-[15px] leading-relaxed text-zinc-300 sm:text-lg">
              {hero.subtitle}
            </p>

            {product && product.reviewCount > 0 && (
              <div data-hero-item className="flex items-center gap-2 text-sm">
                <span className="flex text-amber-400" aria-hidden>
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={i < Math.round(product.rating) ? "size-4 fill-current" : "size-4"} />
                  ))}
                </span>
                <span className="font-semibold">{product.rating.toFixed(1)}</span>
                <span className="text-zinc-400">({product.reviewCount} reviews)</span>
              </div>
            )}

            <div data-hero-item className="flex flex-wrap items-baseline gap-3">
              <Price value={price} className="text-4xl font-black" />
              {compareAt != null && compareAt > price && (
                <>
                  <Price value={compareAt} className="text-lg text-zinc-500 line-through" />
                  <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-ink">
                    Save {Math.round((1 - price / compareAt) * 100)}%
                  </span>
                </>
              )}
            </div>

            <div data-hero-item id="hero-cta" className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <MagneticButton onClick={() => buy(1)} disabled={soldOut} className="shrink-0 whitespace-nowrap sm:w-auto">
                {soldOut ? "Sold out" : hero.cta}
              </MagneticButton>
              <CountdownTimer label={countdown.label} endsAt={countdown.endsAt} tone="dark" />
            </div>

            <div data-hero-item className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5"><Truck className="size-4 text-brand" />Free US shipping</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-brand" />Secure checkout</span>
              <span className="flex items-center gap-1.5"><Check className="size-4 text-brand" />30-day guarantee</span>
            </div>

            <p data-hero-item className="hidden items-center gap-2 pt-4 text-xs uppercase tracking-[0.25em] text-zinc-500 lg:flex">
              <ArrowDown className="size-4 animate-bounce" />
              {hero.scrollHint}
            </p>
          </div>
        </div>

        {/* Beats 1–3: scroll distance for the steps panel above */}
        {story.map((st, i) => (
          <div
            key={st.title}
            id={i === 0 ? "how" : undefined}
            data-beat={i + 1}
            className="h-[calc(100svh-var(--header-h,0px))]"
            aria-hidden
          />
        ))}
      </div>
    </section>
  );
}
