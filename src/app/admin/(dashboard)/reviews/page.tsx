import Link from "next/link";
import { Star as StarIcon } from "lucide-react";
import { getAllAdminReviews } from "@/lib/data/admin-reviews";
import { Badge } from "@/components/ui/badge";
import { ReviewRowActions } from "./review-row-actions";

function truncate(str: string, max: number) {
  if (str.length <= max) return str;
  return str.slice(0, max) + "…";
}

function formatDate(date: Date) {
  return new Date(date).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <StarIcon
          key={i}
          className={`size-3.5 ${
            i < rating
              ? "fill-amber-400 text-amber-400"
              : "fill-muted text-muted"
          }`}
        />
      ))}
    </div>
  );
}

export default async function AdminReviewsPage() {
  const reviews = await getAllAdminReviews();

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight lg:text-3xl">
          Reviews
        </h1>
        <p className="mt-1 text-muted-foreground">
          Moderate customer reviews from your storefront
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card shadow-sm">
        {reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-lg font-medium text-muted-foreground">
              No reviews yet
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Reviews will appear here when customers submit them
            </p>
          </div>
        ) : (
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead>
              <tr className="admin-table-header">
                <th className="px-4 py-3.5">Reviewer</th>
                <th className="px-4 py-3.5">Product</th>
                <th className="px-4 py-3.5">Rating</th>
                <th className="px-4 py-3.5">Comment</th>
                <th className="px-4 py-3.5">Images</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5" />
              </tr>
            </thead>
            <tbody>
              {reviews.map((review) => (
                <tr
                  key={review.id}
                  className="border-b last:border-0 transition-colors hover:bg-muted/40"
                >
                  <td className="px-4 py-3.5 font-semibold">
                    {review.user.fullName}
                  </td>
                  <td className="px-4 py-3.5">
                    <Link
                      href={`/shop/${review.product.slug}`}
                      className="text-primary hover:underline font-medium"
                    >
                      {review.product.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3.5">
                    <StarRating rating={review.rating} />
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3.5 text-muted-foreground">
                    {truncate(review.comment, 60)}
                  </td>
                  <td className="px-4 py-3.5">
                    {review.images.length > 0 ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {review.images.length}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5">
                    <Badge
                      variant={review.isVisible ? "default" : "secondary"}
                      className={
                        review.isVisible
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : ""
                      }
                    >
                      {review.isVisible ? "Visible" : "Hidden"}
                    </Badge>
                  </td>
                  <td className="px-4 py-3.5 text-muted-foreground">
                    {formatDate(review.createdAt)}
                  </td>
                  <td className="px-4 py-3.5">
                    <ReviewRowActions
                      reviewId={review.id}
                      isVisible={review.isVisible}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
