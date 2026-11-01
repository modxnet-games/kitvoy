import type { Metadata } from "next";
import Link from "next/link";

import { storePolicies } from "@/config/policies";
import { formatOrderReference } from "@/lib/data/admin-orders";
import { getOrderForReview } from "@/lib/data/reviews";
import { readReviewToken } from "@/lib/review-links";
import { reviewerName } from "@/lib/reviews";
import { OrderReviewForm } from "./order-review-form";

export const dynamic = "force-dynamic";

// The link is personal: keep it out of search results and out of Referer headers
export const metadata: Metadata = {
  title: "Review your order",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default async function OrderReviewPage({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ rating?: string }> }) {
  const { token } = await params;
  // The email's stars link here with the chosen rating, which the customer can still change
  const picked = Number((await searchParams).rating);
  const initialRating = Number.isInteger(picked) && picked >= 1 && picked <= 5 ? picked : 0;
  const orderId = readReviewToken(token);
  const order = orderId ? await getOrderForReview(orderId).catch(() => null) : null;

  if (!order || order.products.length === 0) {
    return <div className="store-container review-order-page">
      <Link href="/" className="text-link">Back to the store</Link>
      <p className="eyebrow">Kitvoy reviews</p>
      <h1>This review link isn&apos;t working.</h1>
      <p className="review-intro">Please open the link from your email again. If it still doesn&apos;t work, write to <a className="text-link" href={`mailto:${storePolicies.supportEmail}`}>{storePolicies.supportEmail}</a> and we&apos;ll help.</p>
    </div>;
  }

  const firstName = order.customerName.trim().split(/\s+/)[0];
  const author = reviewerName(order.customerName);
  return <div className="store-container review-order-page">
    <Link href="/" className="text-link">Back to the store</Link>
    <p className="eyebrow">Order {formatOrderReference(order.id)}</p>
    <h1>{firstName ? `How's it going, ${firstName}?` : "How's it going?"}</h1>
    <p className="review-intro">Tell other drivers what you think. Your review will be shown as {author} with a Verified Buyer badge. Reviews appear on the site after we check them for spam and personal details.</p>
    {order.products.map(p => p.reviewed
      ? <section key={p.productId} className="review-order-card review-order-done"><h2>{p.productName}</h2><p>Thanks for your review. It will appear on kitvoy.com once we&apos;ve checked it.</p></section>
      : <OrderReviewForm key={p.productId} token={token} productId={p.productId} productName={p.productName} author={author} initialRating={initialRating} />)}
  </div>;
}
