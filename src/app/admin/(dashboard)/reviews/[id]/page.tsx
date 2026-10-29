import { notFound } from "next/navigation";
import Link from "next/link";
import { Star } from "lucide-react";
import { getAdminReviewById } from "@/lib/data/admin-reviews";
import { normalizeMediaSrc } from "@/lib/media-url";
import { Badge } from "@/components/ui/badge";
import { ReviewDetailActions } from "./review-detail-actions";

interface ReviewDetailPageProps {
  params: Promise<{ id: string }>;
}

function formatDate(date: Date) {
  return new Date(date).toLocaleString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminReviewDetailPage({
  params,
}: ReviewDetailPageProps) {
  const { id } = await params;
  const review = await getAdminReviewById(id);

  if (!review) notFound();

  return (
    <div>
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href="/admin/reviews"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Back to reviews
          </Link>
          <h1 className="mt-2 text-2xl font-bold tracking-tight">
            Review by {review.user.fullName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {formatDate(review.createdAt)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge
            variant={review.isVisible ? "default" : "secondary"}
            className={
              review.isVisible ? "bg-emerald-600 hover:bg-emerald-700" : ""
            }
          >
            {review.isVisible ? "Visible" : "Hidden"}
          </Badge>
          <ReviewDetailActions
            reviewId={review.id}
            isVisible={review.isVisible}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold">Comment</h2>
            <p className="mt-3 whitespace-pre-line text-sm text-muted-foreground">
              {review.comment}
            </p>

            <div className="mt-6 flex items-center gap-2">
              <h2 className="font-semibold">Rating</h2>
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
                <span className="ml-2 text-sm text-muted-foreground">
                  {review.rating}/5
                </span>
              </div>
            </div>

            {review.images.length > 0 && (
              <div className="mt-6">
                <h2 className="font-semibold">Screenshots</h2>
                <div className="mt-3 flex flex-wrap gap-3">
                  {review.images.map((url) => {
                    const src = normalizeMediaSrc(url);
                    if (!src) return null;
                    return (
                      <a
                        key={url}
                        href={src}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block"
                      >
                        <img
                          src={src}
                          alt=""
                          className="h-24 w-24 rounded-lg border object-cover hover:opacity-90"
                        />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}

            {review.moderatedAt && (
              <p className="mt-6 text-xs text-muted-foreground">
                Last moderated: {formatDate(review.moderatedAt)}
              </p>
            )}
          </div>
        </div>

        <div>
          <div className="rounded-xl border bg-card p-6">
            <h2 className="font-semibold">Reviewer</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd className="font-medium">{review.user.fullName}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Email</dt>
                <dd>
                  <a
                    href={`mailto:${review.user.email}`}
                    className="text-primary hover:underline"
                  >
                    {review.user.email}
                  </a>
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 rounded-xl border bg-card p-6">
            <h2 className="font-semibold">Product</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div>
                <dt className="text-muted-foreground">Name</dt>
                <dd>
                  <Link
                    href={`/shop/${review.product.slug}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {review.product.name}
                  </Link>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}
