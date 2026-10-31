import type { Metadata } from "next";
import Link from "next/link";

import { storePolicies } from "@/config/policies";
import { PolicyPage } from "@/components/policies/policy-page";

const days = storePolicies.returns.windowDays;
const email = storePolicies.supportEmail;

export const metadata: Metadata = {
  title: "Returns & Refund Policy",
  description: `Return unused Kitvoy items in their original packaging within ${days} days of delivery. Damaged or defective items are replaced or fully refunded.`,
  alternates: { canonical: "/returns" },
};

export default function ReturnsPolicyPage() {
  return (
    <PolicyPage path="/returns" title="Returns & refunds" intro={`If your inflator isn't right for you, you can return it within ${days} days of delivery.`}>
      <section aria-labelledby="window">
        <h2 id="window">{days}-day returns</h2>
        <p>You can return unused items in their original packaging within {days} days of the delivery date for a refund of the price you paid.</p>
      </section>
      <section aria-labelledby="damaged">
        <h2 id="damaged">Damaged, defective or wrong items</h2>
        <p>If your order arrives damaged, doesn&apos;t work, or isn&apos;t what you ordered, email us within {days} days of delivery with your order number and a photo or short video of the problem. We&apos;ll send a replacement or give you a full refund, whichever you prefer, and you won&apos;t pay anything to send it back.</p>
      </section>
      <section aria-labelledby="start">
        <h2 id="start">How to start a return</h2>
        <ol>
          <li>Email <a className="text-link" href={`mailto:${email}`}>{email}</a> with your order number (it starts with KTV-) and the reason for the return.</li>
          <li>We&apos;ll reply with return instructions and the address to send it to.</li>
          <li>Pack the item in its original packaging and ship it with tracking.</li>
          <li>We&apos;ll email you when your return arrives and your refund is on its way.</li>
        </ol>
        <p>Please contact us before sending anything back: returns sent without instructions can&apos;t always be matched to an order.</p>
      </section>
      <section aria-labelledby="costs">
        <h2 id="costs">Return shipping</h2>
        <p>For unused items you&apos;re returning because you changed your mind, return shipping is paid by you. For damaged, defective or incorrect items, we cover it.</p>
      </section>
      <section aria-labelledby="refunds">
        <h2 id="refunds">Refunds</h2>
        <p>Once we receive and check your return, we refund the price you paid to your original payment method through PayPal. Your bank or card issuer may take a few extra days to show it. For bundles, the refund is based on the per-unit price you paid for the returned items.</p>
      </section>
      <section aria-labelledby="not-eligible">
        <h2 id="not-eligible">What can&apos;t be returned</h2>
        <p>Items that have been used, damaged after delivery, or returned without their original packaging or parts aren&apos;t eligible for a change-of-mind refund. This never affects items that arrived damaged or defective.</p>
      </section>
      <section aria-labelledby="cancel">
        <h2 id="cancel">Cancelling an order</h2>
        <p>Email us as soon as possible. If your order hasn&apos;t shipped yet, we&apos;ll cancel it and refund you in full. Once it has shipped, you can return it under this policy. Delivery details are in our <Link className="text-link" href="/shipping">shipping policy</Link>.</p>
      </section>
    </PolicyPage>
  );
}
