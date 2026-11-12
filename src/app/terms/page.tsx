import type { Metadata } from "next";
import Link from "next/link";

import { storePolicies } from "@/config/policies";
import { PolicyPage } from "@/components/policies/policy-page";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms for shopping at kitvoy.com: orders, pricing, payment, shipping, returns, product safety and support.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <PolicyPage path="/terms" title="Terms of service" intro="These terms apply when you use kitvoy.com or buy from Kitvoy. By placing an order, you agree to them.">
      <section aria-labelledby="eligibility">
        <h2 id="eligibility">Who can order</h2>
        <p>You must be at least 18, or have a parent or guardian&apos;s permission, and order for delivery to an address in a country the product ships to (listed in our shipping policy).</p>
      </section>
      <section aria-labelledby="products">
        <h2 id="products">Products and descriptions</h2>
        <p>We describe our products as accurately as we can, using the specifications our supplier provides. Photos are for illustration, and colors or small details may vary slightly.</p>
      </section>
      <section aria-labelledby="pricing">
        <h2 id="pricing">Prices and payment</h2>
        <p>Prices are in US dollars and include standard shipping to the countries each product ships to. Bundle discounts are shown before you add items to your cart. Payment is taken at checkout through Stripe or PayPal; we never see or store your card details.</p>
      </section>
      <section aria-labelledby="orders">
        <h2 id="orders">Orders</h2>
        <p>Your order is confirmed once payment is complete. We email you an order confirmation right away, and a shipping confirmation with your tracking number once it ships. We may cancel an order and refund it in full if an item is unavailable, a price was shown in error, or we suspect fraud.</p>
      </section>
      <section aria-labelledby="shipping-returns">
        <h2 id="shipping-returns">Shipping and returns</h2>
        <p>Delivery times and costs are set out in our <Link className="text-link" href="/shipping">shipping policy</Link>. You can return unused items within {storePolicies.returns.windowDays} days of delivery under our <Link className="text-link" href="/returns">returns & refunds policy</Link>.</p>
      </section>
      <section aria-labelledby="safety">
        <h2 id="safety">Using our products safely</h2>
        <p>Read the product instructions before use, and follow the limits stated on the product page.</p>
        <p><strong>Pet toys.</strong> Choose a toy that suits your pet&apos;s size, supervise play, put the toy away afterwards, and stop using it if it is damaged. A small toy can be swallowed by a larger animal; each product page says which pets it is for.</p>
        <p><strong>Tire inflator.</strong> Inflate only to the pressure recommended by your vehicle or tire manufacturer, stay with the inflator while it runs, and keep it away from children. An inflator is not a repair for a damaged or punctured tire.</p>
      </section>
      <section aria-labelledby="warranty">
        <h2 id="warranty">Warranty and liability</h2>
        <p>Beyond what our returns & refunds policy provides and what the law requires, products are sold without other warranties. To the extent the law allows, Kitvoy isn&apos;t liable for indirect or consequential losses, and our total liability for any order is limited to the amount you paid for it. Nothing in these terms limits rights you have under consumer protection law.</p>
      </section>
      <section aria-labelledby="accounts">
        <h2 id="accounts">Accounts</h2>
        <p>If you create an account, keep your sign-in details private. You&apos;re responsible for activity on your account, and you can ask us to close it at any time.</p>
      </section>
      <section aria-labelledby="content">
        <h2 id="content">Site content</h2>
        <p>The Kitvoy name, logo, text and images on this site belong to Kitvoy or its licensors and may not be copied for commercial use without permission.</p>
      </section>
      <section aria-labelledby="governing-law">
        <h2 id="governing-law">Governing law</h2>
        <p>These terms are governed by the laws of {storePolicies.governingLaw}, without regard to its conflict-of-law rules. This doesn&apos;t take away any consumer protections you have under the law where you live.</p>
      </section>
      <section aria-labelledby="changes">
        <h2 id="changes">Changes to these terms</h2>
        <p>We may update these terms. The version in effect when you place an order applies to that order. Our <Link className="text-link" href="/privacy">privacy policy</Link> explains how we handle your information.</p>
      </section>
    </PolicyPage>
  );
}
