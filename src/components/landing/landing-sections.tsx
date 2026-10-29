import { BatteryCharging, Flashlight, Gauge, Package, RotateCcw, ShieldCheck, Truck } from "lucide-react";

import { landingConfig } from "@/config/landing";
import { SectionHeading } from "@/components/storefront";

const BENEFIT_ICONS = [Gauge, Package, BatteryCharging, Flashlight];

export function TrustBar() {
  const items = [
    { icon: Truck, title: "Free US Shipping", detail: "Tracked delivery to all 50 states" },
    { icon: ShieldCheck, title: "Secure Checkout", detail: "Card & PayPal, SSL encrypted" },
    { icon: RotateCcw, title: "30-Day Guarantee", detail: "Love it or your money back" },
  ];
  return (
    <section className="border-y bg-muted/20">
      <div className="container mx-auto grid grid-cols-1 divide-y px-4 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
        {items.map(({ icon: Icon, title, detail }) => (
          <div key={title} className="flex items-center gap-3 py-4 sm:justify-center sm:py-5">
            <div className="trust-icon-box shrink-0">
              <Icon className="size-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{title}</p>
              <p className="text-xs text-muted-foreground">{detail}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export function Benefits() {
  return (
    <section className="container mx-auto px-4 py-12 md:py-20">
      <SectionHeading title="Why drivers keep one in the car" className="text-center sm:justify-center" />
      <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {landingConfig.benefits.map((b, i) => {
          const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length];
          return (
            <div key={b.title} className="rounded-2xl border bg-card p-6">
              <Icon className="size-8 text-primary" />
              <h3 className="mt-4 font-bold">{b.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{b.text}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section className="container mx-auto max-w-3xl px-4 py-12 md:py-20">
      <SectionHeading title="Questions?" className="text-center sm:justify-center" />
      <div className="mt-8 divide-y rounded-2xl border">
        {landingConfig.faq.map((item) => (
          <details key={item.q} className="group p-5">
            <summary className="flex cursor-pointer list-none items-center justify-between font-semibold">
              {item.q}
              <span className="ml-4 text-xl text-muted-foreground transition group-open:rotate-45">+</span>
            </summary>
            <p className="mt-3 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
