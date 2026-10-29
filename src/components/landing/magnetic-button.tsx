"use client";

import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "motion/react";

import { cn } from "@/lib/utils";

interface MagneticButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
}

/** Primary CTA that leans toward the cursor and has a light sweep on hover. */
export function MagneticButton({ children, onClick, disabled, className }: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const reduce = useReducedMotion();
  const x = useSpring(useMotionValue(0), { stiffness: 220, damping: 15, mass: 0.4 });
  const y = useSpring(useMotionValue(0), { stiffness: 220, damping: 15, mass: 0.4 });

  const onMove = (e: React.PointerEvent) => {
    if (reduce || disabled || e.pointerType !== "mouse" || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * 0.25);
    y.set((e.clientY - (r.top + r.height / 2)) * 0.35);
  };
  const reset = () => {
    x.set(0);
    y.set(0);
  };

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      disabled={disabled}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={{ x, y }}
      whileTap={reduce ? undefined : { scale: 0.96 }}
      className={cn(
        "group relative w-full overflow-hidden rounded-2xl bg-brand px-8 py-4 text-lg font-bold text-white shadow-[0_10px_40px_-10px_rgba(249,115,22,0.8)] transition-shadow hover:shadow-[0_14px_50px_-8px_rgba(249,115,22,0.95)] disabled:opacity-50",
        className,
      )}
    >
      <span className="pointer-events-none absolute inset-y-0 -left-1/2 w-1/3 -skew-x-12 bg-white/30 blur-md transition-transform duration-700 group-hover:translate-x-[420%]" />
      <span className="relative">{children}</span>
    </motion.button>
  );
}
