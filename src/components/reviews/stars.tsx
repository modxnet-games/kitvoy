"use client";

import { useState } from "react";
import { Star } from "lucide-react";

/** Five stars filled to `value` (fractions allowed, e.g. 4.6), announced as "Rated 4.6 out of 5". */
export function Stars({ value, size = 16, className = "" }: { value: number; size?: number; className?: string }) {
  const percent = Math.max(0, Math.min(100, (value / 5) * 100));
  const row = (filled: boolean) => (
    <span className="stars-row" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => <Star key={i} width={size} height={size} strokeWidth={1.5} fill={filled ? "currentColor" : "none"} />)}
    </span>
  );
  return (
    <span className={`stars ${className}`} role="img" aria-label={`Rated ${value} out of 5`}>
      {row(false)}
      <span className="stars-fill" style={{ width: `${percent}%` }}>{row(true)}</span>
    </span>
  );
}

const LABELS = ["Poor", "Fair", "Good", "Very good", "Excellent"];

/** A 1–5 star choice built on radio buttons, so arrow keys and screen readers work as usual. */
export function StarPicker({ value, onChange, name = "rating", legend }: { value: number; onChange: (value: number) => void; name?: string; legend: string }) {
  const [hover, setHover] = useState(0);
  const shown = hover || value;
  return (
    <fieldset className="star-picker" onMouseLeave={() => setHover(0)}>
      <legend>{legend}</legend>
      <div className="star-picker-row">
        {[1, 2, 3, 4, 5].map((star) => (
          <label key={star} onMouseEnter={() => setHover(star)} className={star <= shown ? "is-on" : ""}>
            <input type="radio" name={name} value={star} checked={value === star} onChange={() => onChange(star)} />
            <Star width={30} height={30} strokeWidth={1.5} fill={star <= shown ? "currentColor" : "none"} aria-hidden="true" />
            <span className="sr-only">{star} {star === 1 ? "star" : "stars"}, {LABELS[star - 1]}</span>
          </label>
        ))}
        <span className="star-picker-label" aria-hidden="true">{shown ? LABELS[shown - 1] : ""}</span>
      </div>
    </fieldset>
  );
}
