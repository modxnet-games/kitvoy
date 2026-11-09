import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

// Next.js answers 404 for this page. noindex here replaces the site-wide
// "index, follow", so a missing URL never sends two opposite robots tags.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
};

// A server component on purpose: only plain markup and the storefront's own
// classes, nothing imported from a client module.
export default function NotFound() {
  return (
    <div className="store-container py-16 md:py-24">
      <div className="mx-auto flex max-w-xl flex-col items-center text-center">
        <p className="eyebrow">Error 404</p>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-[#171918] sm:text-4xl">We couldn&apos;t find that page.</h1>
        <p className="mt-4 max-w-md text-base text-[#666a67]">
          The link may be old or mistyped. The cordless tire inflator, and help with an order, are one click away.
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link href="/" className="primary-button">
            Go to the store <ArrowRight size={18} />
          </Link>
          <Link href="/support" className="text-link">
            Help &amp; contact
          </Link>
        </div>
      </div>
    </div>
  );
}
