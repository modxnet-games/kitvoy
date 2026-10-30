"use client";

import { useEffect, useRef } from "react";

/**
 * Sets --tx / --ty (-1…1, pointer position from the element's center) on the
 * element while a mouse or trackpad hovers it, for CSS 3D tilt. Writes style
 * variables once per frame instead of re-rendering. Skipped on touch screens
 * and when the visitor prefers reduced motion.
 */
export function usePointerTilt<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const canTilt = window.matchMedia("(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!canTilt.matches) return;

    let frame = 0;
    const set = (x: number, y: number) => {
      el.style.setProperty("--tx", x.toFixed(3));
      el.style.setProperty("--ty", y.toFixed(3));
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        set(((e.clientX - r.left) / r.width) * 2 - 1, ((e.clientY - r.top) / r.height) * 2 - 1);
        el.dataset.tilting = "true";
      });
    };
    const onLeave = () => {
      cancelAnimationFrame(frame);
      delete el.dataset.tilting;
      set(0, 0);
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    return () => {
      cancelAnimationFrame(frame);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return ref;
}
