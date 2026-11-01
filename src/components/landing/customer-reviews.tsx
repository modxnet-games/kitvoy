"use client";

import { useState } from "react";
import { BadgeCheck } from "lucide-react";
import { Stars } from "@/components/reviews/stars";
import { normalizeMediaSrc } from "@/lib/media-url";
import { REVIEWS_SHOWN_FIRST, type ReviewSummary } from "@/lib/reviews";
import { STORE_TIME_ZONE } from "@/lib/formatters";

// Fixed time zone so the server render and the browser agree on the date
const dateFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: STORE_TIME_ZONE });

/** Approved reviews only; the page renders nothing here while there are none. */
export function CustomerReviews({ summary }: { summary: ReviewSummary }) {
  const [shown, setShown] = useState(REVIEWS_SHOWN_FIRST);
  const { count, average, distribution, reviews } = summary;
  const visible = reviews.slice(0, shown);

  return <section id="reviews" className="store-container reviews-section" aria-labelledby="reviews-heading">
    <div className="reviews-overview">
      <p className="eyebrow">Customer reviews</p>
      <h2 id="reviews-heading">What customers<br />are saying.</h2>
      <div className="rating-score">
        <strong>{average.toFixed(1)}</strong>
        <div><Stars value={average} size={20} /><span>{average.toFixed(1)} out of 5 · {count} {count === 1 ? "review" : "reviews"}</span></div>
      </div>
      <ul className="rating-bars" aria-label="Reviews by star rating">
        {distribution.map((n, i) => <li key={i}><span>{5 - i} star</span><span className="rating-bar" aria-hidden="true"><span style={{ width: `${count ? (n / count) * 100 : 0}%` }} /></span><span>{n}<span className="sr-only"> {n === 1 ? "review" : "reviews"}</span></span></li>)}
      </ul>
      <p className="reviews-note">Reviews are checked for spam and personal details before they appear. Verified Buyer means the review is linked to a paid Kitvoy order.</p>
    </div>
    <div className="reviews-list">
      {visible.map(review => <article key={review.id} className="review-card">
        <div className="review-card-top"><Stars value={review.rating} /><time dateTime={review.publishedOn}>{dateFormat.format(new Date(review.createdAt))}</time></div>
        <p className="review-text">{review.comment}</p>
        {review.images.length > 0 && <div className="review-photos">{review.images.map(url => {
          const src = normalizeMediaSrc(url);
          return src ? <a key={url} href={src} target="_blank" rel="noopener noreferrer"><img src={src} alt={`Photo from ${review.author}'s review`} width={72} height={72} loading="lazy" /></a> : null;
        })}</div>}
        <footer><strong>{review.author}</strong>{review.verified && <span className="verified-badge"><BadgeCheck size={15} aria-hidden="true" />Verified Buyer</span>}</footer>
      </article>)}
      {reviews.length > shown && <button type="button" className="text-link reviews-more" onClick={() => setShown(n => n + REVIEWS_SHOWN_FIRST)}>Show more reviews</button>}
    </div>
  </section>;
}
