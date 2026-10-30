"use client";

import { useState } from "react";
import Image from "next/image";
import { normalizeMediaSrc, isVideoMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

interface ProductLineImageProps {
  imageUrl: string | null | undefined;
  alt: string;
  fallbackLetter: string;
  className?: string;
  imgClassName?: string;
}

/**
 * Thumbnail for cart / checkout rows: first product image, or letter fallback on error / empty.
 */
export function ProductLineImage({
  imageUrl,
  alt,
  fallbackLetter,
  className,
  imgClassName,
}: ProductLineImageProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = normalizeMediaSrc(imageUrl ?? "");
  const isVideo = Boolean(src) && isVideoMediaUrl(src);
  const showMedia = Boolean(src) && failedSrc !== src;
  const letter = (fallbackLetter || "?").charAt(0).toUpperCase();

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-muted",
        className,
      )}
    >
      {showMedia ? (
        isVideo ? (
          <video
            src={src}
            muted
            playsInline
            preload="metadata"
            className={cn("absolute inset-0 size-full object-cover", imgClassName)}
            onError={() => setFailedSrc(src)}
            aria-label={alt}
          />
        ) : (
          <Image
            width={160}
            height={160}
            src={src}
            alt={alt}
            className={cn("absolute inset-0 size-full object-cover", imgClassName)}
            onError={() => setFailedSrc(src)}
            loading="lazy"
            // Uploads are served by nginx outside public/, so the optimizer can't read them
            unoptimized={src.startsWith("/uploads/")}
          />
        )
      ) : (
        <div className="flex size-full min-h-[2.5rem] items-center justify-center">
          <span className="text-lg font-medium text-muted-foreground/40">{letter}</span>
        </div>
      )}
    </div>
  );
}
