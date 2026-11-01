"use client";

import { useState } from "react";
import { Upload, X } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";
import { StarPicker } from "@/components/reviews/stars";
import { REVIEW_COMMENT_MAX } from "@/lib/reviews";
import { submitReviewAction, uploadReviewImageAction } from "@/app/shop/[slug]/review-actions";

interface ReviewFormProps {
  productId: string;
  productSlug: string;
}

const MAX_PHOTOS = 4;

export function ReviewForm({ productId, productSlug }: ReviewFormProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [uploading, setUploading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData();
    formData.set("rating", String(rating));
    formData.set("comment", comment);
    imageUrls.forEach((url) => formData.append("imageUrls", url));

    const result = await submitReviewAction(productId, productSlug, formData);
    setIsPending(false);

    if (result.success) {
      window.location.reload();
    } else {
      setError(
        result.error?.startsWith("reviews.")
          ? t(result.error)
          : result.error ?? t("reviews.submitError")
      );
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadReviewImageAction(formData);
    setUploading(false);

    if (result.url) setImageUrls((urls) => [...urls, result.url!]);
    else if (result.error) setError(result.error.startsWith("reviews.") ? t(result.error) : result.error);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <StarPicker value={rating} onChange={setRating} name={`rating-${productId}`} legend={t("reviews.yourRating")} />

      <div>
        <label htmlFor="comment" className="mb-1.5 block text-sm font-medium">
          {t("reviews.commentLabel")}
        </label>
        <textarea
          id="comment"
          name="comment"
          required
          rows={4}
          maxLength={REVIEW_COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={t("reviews.commentPlaceholder")}
          className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-muted-foreground">
          {t("reviews.optionalScreenshots")}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {imageUrls.map((url) => (
            <div key={url} className="relative">
              <img src={url} alt="" className="h-16 w-16 rounded-lg border object-cover" />
              <button
                type="button"
                onClick={() => setImageUrls((urls) => urls.filter((u) => u !== url))}
                className="absolute -right-2 -top-2 inline-flex size-6 items-center justify-center rounded-full border bg-background"
                aria-label="Remove photo"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {imageUrls.length < MAX_PHOTOS && (
            <>
              <input
                id={`review-upload-${productId}`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="sr-only"
                onChange={handleUpload}
                disabled={uploading}
              />
              <label
                htmlFor={`review-upload-${productId}`}
                className={`inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-md border border-input bg-background px-3 text-sm font-medium hover:bg-accent ${
                  uploading ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                <Upload className="size-4" />
                {uploading ? "..." : t("reviews.upload")}
              </label>
            </>
          )}
        </div>
      </div>

      <Button type="submit" disabled={isPending || rating < 1}>
        {isPending ? t("reviews.submitting") : t("reviews.submit")}
      </Button>
    </form>
  );
}
