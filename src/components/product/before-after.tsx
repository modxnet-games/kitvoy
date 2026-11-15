"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";

interface Photo {
  src: string;
  alt: string;
}

/**
 * Two photos of one scene under a divider: the "after" photo shows to the
 * right of it. Drag anywhere on the picture, or use the arrow keys (the whole
 * picture is a range slider underneath, so it works from the keyboard too).
 */
export function BeforeAfter({ before, after }: { before: Photo; after: Photo }) {
  const [pos, setPos] = useState(50);
  const box = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const fromClientX = useCallback((x: number) => {
    const r = box.current?.getBoundingClientRect();
    if (!r) return;
    setPos(Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)));
  }, []);

  return (
    <figure style={{ margin: 0 }}>
      <div
        ref={box}
        className="kv-ba"
        style={{ ["--pos" as string]: `${pos}%` }}
        onPointerDown={(e) => {
          dragging.current = true;
          (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
          fromClientX(e.clientX);
        }}
        onPointerMove={(e) => {
          if (dragging.current) fromClientX(e.clientX);
        }}
        onPointerUp={() => {
          dragging.current = false;
        }}
        onPointerCancel={() => {
          dragging.current = false;
        }}
      >
        <Image src={before.src} alt={before.alt} fill sizes="(min-width: 1240px) 1200px, 100vw" />
        <Image className="kv-ba-after" src={after.src} alt={after.alt} fill sizes="(min-width: 1240px) 1200px, 100vw" />
        <span className="kv-ba-label l">Before</span>
        <span className="kv-ba-label r">After</span>
        <div className="kv-ba-handle" aria-hidden="true">
          <div className="kv-ba-knob">
            <svg width="22" height="14" viewBox="0 0 22 14" fill="none">
              <path d="M7 1L1 7l6 6M15 1l6 6-6 6" stroke="currentColor" strokeWidth="1.8" />
            </svg>
          </div>
        </div>
        <input
          className="kv-ba-range"
          type="range"
          min={0}
          max={100}
          value={Math.round(pos)}
          onChange={(e) => setPos(Number(e.target.value))}
          aria-label="Drag to compare before and after"
        />
      </div>
      <figcaption className="kv-caption" style={{ marginTop: 10, color: "rgba(251, 248, 241, 0.6)" }}>
        Drag the handle to compare.
      </figcaption>
    </figure>
  );
}
