"use client";

import { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/language-context";
import { StarPicker } from "@/components/reviews/stars";
import { REVIEW_COMMENT_MAX } from "@/lib/reviews";
import { submitOrderReviewAction } from "./actions";

interface OrderReviewFormProps {
  token: string;
  productId: string;
  productName: string;
  /** How the review will be signed, e.g. "Sam L." */
  author: string;
  initialRating?: number;
}

export function OrderReviewForm({ token, productId, productName, author, initialRating = 0 }: OrderReviewFormProps) {
  const { t } = useLanguage();
  const [rating, setRating] = useState(initialRating);
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    setError(null);
    if (rating < 1) return setError(t("reviews.ratingRequired"));
    setPending(true);
    const formData = new FormData();
    formData.set("rating", String(rating));
    formData.set("comment", comment);
    const result = await submitOrderReviewAction(token, productId, formData).catch(() => ({ success: false as const, error: "reviews.submitError" }));
    setPending(false);
    if (result.success) setDone(true);
    else setError(t(result.error));
  }

  if (done) {
    return <section className="review-order-card review-order-done" aria-live="polite">
      <h2>{t("reviews.thanksTitle")}</h2>
      <p>{t("reviews.thanksText")}</p>
    </section>;
  }

  const fieldId = `review-${productId}`;
  return <section className="review-order-card" aria-labelledby={`${fieldId}-title`}>
    <h2 id={`${fieldId}-title`}>{productName}</h2>
    <form onSubmit={handleSubmit} noValidate>
      {error && <p role="alert" className="form-error">{error}</p>}
      <StarPicker value={rating} onChange={(value) => { setRating(value); setError(null); }} name={`${fieldId}-rating`} legend={t("reviews.yourRating")} />
      <div>
        <label htmlFor={fieldId}>{t("reviews.commentLabel")}</label>
        <textarea
          id={fieldId}
          required
          maxLength={REVIEW_COMMENT_MAX}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What did you use it for, and how did it do?"
        />
        <p className="field-hint"><span>Shown as {author}</span><span>{comment.length}/{REVIEW_COMMENT_MAX}</span></p>
      </div>
      <button type="submit" className="primary-button" disabled={pending}>
        {pending ? <><Loader2 className="animate-spin" size={18} />{t("reviews.submitting")}</> : <>{t("reviews.submit")}<ArrowRight size={18} /></>}
      </button>
    </form>
  </section>;
}
