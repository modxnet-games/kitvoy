"use client";

import { Star } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import type { ReviewWithUser } from "@/lib/data/reviews";
import { normalizeMediaSrc } from "@/lib/media-url";

interface ReviewsListProps {
  reviews: ReviewWithUser[];
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(date));
}

export function ReviewsList({ reviews }: ReviewsListProps) {
  const { t } = useLanguage();

  if (reviews.length === 0) {
    return <p className="text-sm text-muted-foreground">{t("reviews.noReviews")}</p>;
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <div key={review.id} className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <p className="font-medium">{review.user.fullName}</p>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Star
                    key={value}
                    className={
                      value <= review.rating
                        ? "size-4 fill-amber-400 text-amber-400"
                        : "size-4 text-muted-foreground/30"
                    }
                  />
                ))}
                <span className="ml-1 text-xs text-muted-foreground">
                  {review.rating} {t("reviews.stars")}
                </span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              {formatDate(review.createdAt)}
            </p>
          </div>
          <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
            {review.comment}
          </p>
          {review.images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {review.images.map((url) => {
                const src = normalizeMediaSrc(url);
                if (!src) return null;
                return (
                  <a key={url} href={src} target="_blank" rel="noopener noreferrer">
                    <img
                      src={src}
                      alt=""
                      className="h-20 w-20 rounded-lg border object-cover"
                    />
                  </a>
                );
              })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
