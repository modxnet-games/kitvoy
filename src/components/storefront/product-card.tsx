"use client";

import Link from "next/link";
import { Star, ShoppingBag } from "lucide-react";

import type { ProductDisplay } from "@/types/product";
import { useCartStore } from "@/store/cart-store";
import { useLanguage } from "@/contexts/language-context";
import { Price } from "./price";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { normalizeMediaSrc, isVideoMediaUrl } from "@/lib/media-url";

interface ProductCardProps {
  product: ProductDisplay;
  className?: string;
}

export function ProductCard({ product, className }: ProductCardProps) {
  const { t } = useLanguage();
  const addItem = useCartStore((s) => s.addItem);
  const hasDiscount = product.compareAtPrice != null;
  const primaryImageSrc = normalizeMediaSrc(product.images?.[0] ?? "");
  const primaryIsVideo = Boolean(primaryImageSrc && isVideoMediaUrl(primaryImageSrc));

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem(product, 1);
  };

  const discountPercent = hasDiscount
    ? Math.round(
        ((product.compareAtPrice! - product.price) / product.compareAtPrice!) *
          100,
      )
    : 0;

  return (
    <Link
      href={`/shop/${product.slug}`}
      className={cn("group flex flex-col h-full overflow-hidden rounded-2xl border border-border/40 bg-card shadow-sm hover:shadow-lg transition-all duration-300", className)}
    >
      <div className="relative shrink-0 overflow-hidden bg-muted aspect-square">
        {primaryImageSrc ? (
          primaryIsVideo ? (
            <video
              src={primaryImageSrc}
              muted
              playsInline
              preload="metadata"
              className="size-full object-contain p-2 transition-transform duration-700 ease-in-out group-hover:scale-105"
              aria-label={product.name}
            />
          ) : (
            <img
              src={primaryImageSrc}
              alt={product.name}
              className="size-full object-contain p-2 transition-transform duration-700 ease-in-out group-hover:scale-105"
            />
          )
        ) : (
          <div className="flex size-full items-center justify-center bg-gradient-to-br from-muted to-muted/60">
            <span className="text-5xl font-light text-muted-foreground/25">
              {product.category.name.charAt(0)}
            </span>
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1 sm:left-3 sm:top-3 sm:gap-1.5">
          {product.stock === 0 ? (
            <Badge variant="destructive" className="text-[10px] font-semibold uppercase tracking-wider">
              {t("stock.outOfStock")}
            </Badge>
          ) : (
            <>
              {product.badge && (
                <Badge
                  variant={product.badge === "Sale" ? "destructive" : "secondary"}
                  className="text-[10px] font-semibold uppercase tracking-wider"
                >
                  {product.badge === "Sale" ? t("product.badgeSale") : product.badge}
                </Badge>
              )}
              {hasDiscount && (
                <Badge variant="destructive" className="text-[10px] font-semibold">
                  -{discountPercent}%
                </Badge>
              )}
              {!product.badge && !hasDiscount && product.stock > 0 && product.stock <= 5 && (
                <Badge variant="secondary" className="text-[10px] font-semibold uppercase tracking-wider">
                  {t("stock.lowStock")}
                </Badge>
              )}
            </>
          )}
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/80 sm:text-[11px]">
          {product.category.name}
        </p>
        <h3 className="mt-1 line-clamp-2 text-[13px] font-medium leading-snug group-hover:text-primary transition-colors sm:text-[15px]">
          {product.name}
        </h3>
        <div className="mt-1.5 flex items-center gap-2">
          <Price value={product.price} className="text-sm font-bold text-foreground sm:text-base" />
          {hasDiscount && (
            <Price
              value={product.compareAtPrice!}
              className="text-[11px] text-muted-foreground line-through font-medium sm:text-xs"
            />
          )}
        </div>
        <div className="mt-1 flex items-center gap-1.5">
          <div className="flex items-center gap-0.5">
            <Star className="size-3 fill-amber-400 text-amber-400 sm:size-3.5" />
            <span className="text-[11px] font-semibold sm:text-xs">{product.rating}</span>
          </div>
          <span className="text-[10px] text-muted-foreground font-medium sm:text-[11px]">
            ({product.reviewCount})
          </span>
        </div>

        <div className="mt-auto w-full pt-2">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2.5 text-[12px] font-bold text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:px-4 sm:py-3 sm:text-[13px]"
            onClick={handleAddToCart}
            disabled={product.stock === 0}
            aria-label={t("product.addToCart")}
          >
            <ShoppingBag className="size-4 sm:size-[18px]" />
            {t("product.addToCart")}
          </button>
        </div>
      </div>
    </Link>
  );
}
