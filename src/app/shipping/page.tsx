import type { Metadata } from "next";
import Link from "next/link";

import { catalog, shipsTo } from "@/config/catalog";
import { deliveryText, processingText, storePolicies } from "@/config/policies";
import { COUNTRY_RULES } from "@/lib/us-address";
import { PolicyPage } from "@/components/policies/policy-page";

const { shipping } = storePolicies;

export const metadata: Metadata = {
  title: "Shipping Policy",
  description: `Free tracked shipping on every Kitvoy order. Orders process in ${processingText}; US orders arrive ${deliveryText} after they ship.`,
  alternates: { canonical: "/shipping" },
};

export default function ShippingPolicyPage() {
  return (
    <PolicyPage path="/shipping" title="Shipping policy" intro="Every Kitvoy order ships free, with tracking. Where we deliver depends on the product.">
      <section aria-labelledby="cost">
        <h2 id="cost">Free shipping</h2>
        <p>Standard shipping is free on every order. There&apos;s no minimum order, and the shipping cost and order total are shown in your cart before you pay.</p>
      </section>
      <section aria-labelledby="destinations">
        <h2 id="destinations">Where we ship</h2>
        <p>Orders are packed and sent by our partner warehouse overseas. Each product ships to the countries listed for it, and checkout only accepts an address in one of them. Within the United States we deliver to {shipping.destinations}.</p>
        <ul>
          {catalog.map((product) => (
            <li key={product.slug}>
              <strong>{product.shortName}:</strong>{" "}
              {shipsTo(product.slug)
                .map((code) => `${COUNTRY_RULES[code].name} (${product.shipping[code]!.days.min}–${product.shipping[code]!.days.max} days)`)
                .join(", ")}
            </li>
          ))}
        </ul>
        <p>The days shown are the usual time in transit after your order ships.</p>
      </section>
      <section aria-labelledby="duties">
        <h2 id="duties">Import taxes outside the United States</h2>
        <p>Our prices include shipping. For orders delivered outside the United States, import VAT or customs duties, where your country charges them on parcels from abroad, are collected on delivery and are not included in the price.</p>
      </section>
      <section aria-labelledby="processing">
        <h2 id="processing">Processing time</h2>
        <p>We process orders within {processingText} of your payment being confirmed. Business days are Monday to Friday, excluding US federal holidays, so orders placed on a weekend or holiday start processing the next business day.</p>
      </section>
      <section aria-labelledby="delivery">
        <h2 id="delivery">Delivery time</h2>
        <p>Once your order ships, delivery within the United States usually takes {deliveryText} with {shipping.carrier}, a tracked shipping service. Counting processing, most US orders arrive {shipping.processingDays.min + shipping.deliveryDays.min}–{shipping.processingDays.max + shipping.deliveryDays.max} business days after you order. Times for other countries are listed above.</p>
        <p>Delivery times are estimates, not guarantees. Weather, carrier delays and busy holiday periods can add time.</p>
      </section>
      <section aria-labelledby="tracking">
        <h2 id="tracking">Tracking your order</h2>
        <p>When your order ships, we email you its tracking number. If you have an account, you can also find it under <Link className="text-link" href="/account/orders">Track your order</Link>.</p>
      </section>
      <section aria-labelledby="address">
        <h2 id="address">Your delivery address</h2>
        <p>Please check your address at checkout. If you spot a mistake, email us as soon as you can: we can change the address if your order hasn&apos;t shipped yet.</p>
      </section>
      <section aria-labelledby="problems">
        <h2 id="problems">Late, lost or damaged packages</h2>
        <p>If your order hasn&apos;t arrived by the end of the delivery time for your country, or tracking stops updating, email us and we&apos;ll follow up with the carrier. If a package is confirmed lost, we&apos;ll send a replacement or give you a full refund.</p>
        <p>If your order arrives damaged, see our <Link className="text-link" href="/returns">returns & refunds policy</Link>: we&apos;ll replace it or refund you in full.</p>
      </section>
    </PolicyPage>
  );
}
