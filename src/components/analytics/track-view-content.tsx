"use client";

import { useEffect, useRef } from "react";

import { trackViewContent } from "@/lib/analytics/meta-pixel";

/** Sends Meta's ViewContent once for the product page it sits on. */
export function TrackViewContent({ product }: { product: { id: string; sku: string; name: string; price: number; slug?: string } | null }) {
  const sentFor = useRef<string | null>(null);
  const id = product?.id ?? null;
  useEffect(() => {
    // Once per product per page view, even when React runs the effect twice (dev Strict Mode)
    if (!product || !id || sentFor.current === id) return;
    sentFor.current = id;
    trackViewContent(product);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  return null;
}
