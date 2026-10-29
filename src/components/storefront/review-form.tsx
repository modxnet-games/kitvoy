"use client";

import { useState } from "react";
import Link from "next/link";
import { Star, Upload } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { submitReviewAction, uploadReviewImageAction } from "@/app/shop/[slug]/review-actions";

interface ReviewFormProps {
  productId: string;
  productSlug: string;
}

export function ReviewForm({ productId, productSlug }: ReviewFormProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [imageUrls, setImageUrls] = useState<string[]>([""]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsPending(true);

    const formData = new FormData();
    formData.set("rating", String(rating));
    formData.set("comment", comment);
    imageUrls.filter(Boolean).forEach((url) => formData.append("imageUrls", url));

    const result = await submitReviewAction(productId, productSlug, formData);
    setIsPending(false);

    if (result.success) {
      setRating(0);
      setComment("");
      setImageUrls([""]);
      window.location.reload();
    } else {
      setError(
        result.error?.startsWith("reviews.")
          ? t(result.error)
          : result.error ?? t("reviews.submitError")
      );
    }
  }

  async function handleUpload(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingIndex(index);

    const formData = new FormData();
    formData.set("file", file);
    const result = await uploadReviewImageAction(formData);
    setUploadingIndex(null);
    e.target.value = "";

    if (result.url) {
      const next = [...imageUrls];
      next[index] = result.url;
      setImageUrls(next);
    }
  }

  const displayRating = hoverRating || rating;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div
          role="alert"
          className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive"
        >
          {error}
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium">{t("reviews.yourRating")}</p>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setRating(value)}
              onMouseEnter={() => setHoverRating(value)}
              onMouseLeave={() => setHoverRating(0)}
              className="p-0.5"
            >
              <Star
                className={`size-8 transition-colors ${
                  value <= displayRating
                    ? "fill-amber-400 text-amber-400"
                    : "text-muted-foreground/40"
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="comment" className="mb-1.5 block text-sm font-medium">
          {t("reviews.commentRequired")}
        </label>
        <textarea
          id="comment"
          name="comment"
          required
          rows={4}
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
        <div className="space-y-2">
          {imageUrls.map((url, i) => (
            <div key={i} className="flex gap-2">
              <Input
                value={url}
                onChange={(e) => {
                  const next = [...imageUrls];
                  next[i] = e.target.value;
                  setImageUrls(next);
                }}
                placeholder="https://... or upload"
                className="flex-1"
              />
              <input
                id={`review-upload-${i}`}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                className="hidden"
                onChange={(e) => handleUpload(i, e)}
                disabled={uploadingIndex !== null}
              />
              <label
                htmlFor={`review-upload-${i}`}
                className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-2 text-sm font-medium hover:bg-accent ${
                  uploadingIndex !== null ? "cursor-not-allowed opacity-50" : ""
                }`}
              >
                <Upload className="size-4" />
                {uploadingIndex === i ? "..." : t("reviews.upload")}
              </label>
            </div>
          ))}
        </div>
      </div>

      <Button type="submit" disabled={isPending || rating < 1}>
        {isPending ? t("reviews.submitting") : t("reviews.submit")}
      </Button>
    </form>
  );
}
