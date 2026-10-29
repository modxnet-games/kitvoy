"use client";

import { Check, PlayCircle, ShieldCheck, Star, Truck } from "lucide-react";

import { landingConfig } from "@/config/landing";
import { Price } from "@/components/storefront";
import { normalizeMediaSrc } from "@/lib/media-url";
import type { ProductDisplay } from "@/types/product";
import { CountdownTimer } from "./countdown-timer";
import { useBuyBundle } from "./use-buy-bundle";

interface LandingHeroProps {
  product: ProductDisplay | null;
}

export function LandingHero({ product }: LandingHeroProps) {
  const { hero, countdown, fallback } = landingConfig;
  const buy = useBuyBundle(product);

  const name = product?.name ?? fallback.name;
  const price = product?.price ?? fallback.price;
  const compareAt = product ? product.compareAtPrice : fallback.compareAtPrice;
  const poster = normalizeMediaSrc(hero.videoPoster || product?.images[0] || "");
  const soldOut = product !== null && product.stock <= 0;

  return (
    <section className="container mx-auto grid gap-8 px-4 py-8 md:py-12 lg:grid-cols-2 lg:items-center lg:gap-12">
      {/* Video */}
      <div className="relative aspect-square overflow-hidden rounded-2xl border bg-gradient-to-br from-slate-900 to-slate-700 shadow-xl sm:aspect-video lg:aspect-square">
        {hero.videoSrc ? (
          <video
            className="size-full object-cover"
            src={hero.videoSrc}
            poster={poster || undefined}
            autoPlay
            muted
            loop
            playsInline
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center gap-3 text-white/90">
            {poster && (
              <img src={poster} alt="" className="absolute inset-0 size-full object-cover opacity-40" />
            )}
            <PlayCircle className="relative size-16 sm:size-20" strokeWidth={1.25} />
            <p className="relative text-sm font-medium">Product video coming soon</p>
          </div>
        )}
      </div>

      {/* Copy */}
      <div className="space-y-5">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">{hero.eyebrow}</p>
        <h1 className="text-3xl font-black tracking-tight sm:text-4xl lg:text-5xl">{hero.title}</h1>
        {product && product.reviewCount > 0 && (
          <div className="flex items-center gap-2 text-sm">
            <span className="flex text-amber-500" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={i < Math.round(product.rating) ? "size-4 fill-current" : "size-4"}
                />
              ))}
            </span>
            <span className="font-medium">{product.rating.toFixed(1)}</span>
            <span className="text-muted-foreground">({product.reviewCount} reviews)</span>
          </div>
        )}
        <p className="text-base text-muted-foreground sm:text-lg">{hero.subtitle}</p>

        <ul className="space-y-2">
          {hero.bullets.map((b) => (
            <li key={b} className="flex items-start gap-2 text-sm sm:text-base">
              <Check className="mt-0.5 size-5 shrink-0 text-green-600" />
              {b}
            </li>
          ))}
        </ul>

        <p className="text-sm font-medium text-muted-foreground">{name}</p>
        <div className="!mt-1 flex items-baseline gap-3">
          <Price value={price} className="text-3xl font-bold" />
          {compareAt != null && compareAt > price && (
            <>
              <Price value={compareAt} className="text-lg text-muted-foreground line-through" />
              <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-bold text-white">
                Save {Math.round((1 - price / compareAt) * 100)}%
              </span>
            </>
          )}
        </div>

        <CountdownTimer label={countdown.label} endsAt={countdown.endsAt} />

        <button
          type="button"
          onClick={() => buy(1)}
          disabled={soldOut}
          className="w-full rounded-xl bg-primary px-6 py-4 text-lg font-bold text-primary-foreground shadow-lg transition hover:bg-primary/90 disabled:opacity-50"
        >
          {soldOut ? "Sold out" : hero.cta}
        </button>

        <div className="grid grid-cols-3 gap-2 text-center text-xs text-muted-foreground">
          <span className="flex flex-col items-center gap-1">
            <Truck className="size-5 text-foreground" />
            Free US Shipping
          </span>
          <span className="flex flex-col items-center gap-1">
            <ShieldCheck className="size-5 text-foreground" />
            Secure Checkout
          </span>
          <span className="flex flex-col items-center gap-1">
            <Check className="size-5 text-foreground" />
            30-Day Guarantee
          </span>
        </div>
      </div>
    </section>
  );
}
