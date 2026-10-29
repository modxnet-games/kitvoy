"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import dynamic from "next/dynamic";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ArrowDown, Check, ShieldCheck, Star, Truck } from "lucide-react";

import { landingConfig } from "@/config/landing";
import { Price } from "@/components/storefront";
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
          progress.current = self.progress;
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

      gsap.utils.toArray<HTMLElement>("[data-step-card]").forEach((card) => {
        gsap.fromTo(
          card,
          { y: 80, opacity: 0, filter: "blur(8px)" },
          {
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            ease: "power2.out",
            scrollTrigger: { trigger: card, start: "top 85%", end: "center 55%", scrub: true },
          },
        );
        gsap.to(card, {
          y: -60,
          opacity: 0,
          ease: "power1.in",
          scrollTrigger: { trigger: card, start: "center 30%", end: "bottom top", scrub: true },
        });
      });
    },
    { scope: section, dependencies: [reducedMotion] },
  );

  return (
    <section
      ref={section}
      className="relative bg-[radial-gradient(ellipse_at_70%_40%,#1e293b_0%,#0b1220_55%,#05080f_100%)] text-white"
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-[#05080f] via-[#05080f]/80 to-transparent lg:hidden" />
      </div>

      {/* Scrolling beats */}
      <div className="relative -mt-[calc(100svh-var(--header-h,0px))]">
        {/* Beat 0: hero */}
        <div data-beat="0" className="container mx-auto flex min-h-[calc(100svh-var(--header-h,0px))] items-end px-4 pb-10 pt-[40svh] lg:items-center lg:py-16">
          <div data-hero-copy className="max-w-xl space-y-5 lg:space-y-4 xl:space-y-5">
            <p data-hero-item className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-brand backdrop-blur">
              <span className="size-1.5 rounded-full bg-brand" />
              {hero.eyebrow}
            </p>
            <h1 data-hero-item className="text-balance text-4xl font-black leading-[1.02] tracking-tight sm:text-6xl lg:text-[3.6rem] xl:text-7xl">
              {hero.title.split(" ").map((word, i, words) =>
                i >= words.length - 2 ? (
                  <span key={i} className="bg-gradient-to-r from-brand to-amber-300 bg-clip-text text-transparent">
                    {word}{" "}
                  </span>
                ) : (
                  <span key={i}>{word} </span>
                ),
              )}
            </h1>
            <p data-hero-item className="max-w-md text-base text-slate-300 sm:text-lg">
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
                <span className="text-slate-400">({product.reviewCount} reviews)</span>
              </div>
            )}

            <div data-hero-item className="flex flex-wrap items-baseline gap-3">
              <Price value={price} className="text-4xl font-black" />
              {compareAt != null && compareAt > price && (
                <>
                  <Price value={compareAt} className="text-lg text-slate-500 line-through" />
                  <span className="rounded-full bg-brand px-2.5 py-0.5 text-xs font-bold text-white">
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

            <div data-hero-item className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><Truck className="size-4 text-brand" />Free US shipping</span>
              <span className="flex items-center gap-1.5"><ShieldCheck className="size-4 text-brand" />Secure checkout</span>
              <span className="flex items-center gap-1.5"><Check className="size-4 text-brand" />30-day guarantee</span>
            </div>

            <p data-hero-item className="hidden items-center gap-2 pt-4 text-xs uppercase tracking-[0.25em] text-slate-500 lg:flex">
              <ArrowDown className="size-4 animate-bounce" />
              {hero.scrollHint}
            </p>
          </div>
        </div>

        {/* Beats 1–3: how it works */}
        {story.map((step, i) => (
          <div
            key={step.title}
            data-beat={i + 1}
            className="container mx-auto flex min-h-[calc(100svh-var(--header-h,0px))] items-end px-4 pb-16 lg:items-center lg:pb-0"
          >
            <div
              data-step-card
              className="max-w-md rounded-3xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl backdrop-blur-xl"
            >
              <div className="flex items-center gap-3">
                <span className="flex size-9 items-center justify-center rounded-full bg-brand text-sm font-black text-white">
                  {i + 1}
                </span>
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand">{step.kicker}</span>
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-4xl">{step.title}</h2>
              <p className="mt-3 text-slate-300">{step.text}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
