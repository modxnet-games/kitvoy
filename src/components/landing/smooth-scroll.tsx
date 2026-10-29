"use client";

import { useEffect } from "react";
import Lenis from "lenis";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/** Scrollable overlays (cart drawer, search, sheets) keep native scrolling. */
function shouldPreventSmoothScroll(node: HTMLElement): boolean {
  return !!node.closest(
    '[data-lenis-prevent], [role="dialog"], .overflow-y-auto, .overflow-auto',
  );
}

/**
 * Landing-page-only: Lenis smooth scrolling synced to GSAP's ticker, plus a
 * batched fade-up for every `[data-reveal]` element. Both are skipped when the
 * visitor prefers reduced motion.
 */
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({
      autoRaf: false,
      lerp: 0.1,
      prevent: shouldPreventSmoothScroll,
    });
    const raf = (time: number) => lenis.raf(time * 1000);
    lenis.on("scroll", ScrollTrigger.update);
    gsap.ticker.add(raf);
    gsap.ticker.lagSmoothing(0);

    const root = document.documentElement;
    root.classList.add("reveal-ready");
    const batch = ScrollTrigger.batch("[data-reveal]", {
      start: "top 88%",
      once: true,
      onEnter: (els) =>
        gsap.to(els, {
          opacity: 1,
          y: 0,
          duration: 0.9,
          ease: "power3.out",
          stagger: 0.08,
          overwrite: true,
        }),
    });
    ScrollTrigger.refresh();

    return () => {
      batch.forEach((t) => t.kill());
      root.classList.remove("reveal-ready");
      gsap.ticker.remove(raf);
      lenis.destroy();
    };
  }, []);

  return <>{children}</>;
}
