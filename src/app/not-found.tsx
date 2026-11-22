import type { Metadata } from "next";
import Link from "next/link";

import { policyContent } from "@/config/policy-content";
import { getLocale } from "@/lib/locale-server";
import { getMessages } from "@/messages";

// Next.js answers 404 for this page. noindex here replaces the site-wide
// "index, follow", so a missing URL never sends two opposite robots tags.
export async function generateMetadata(): Promise<Metadata> {
  return { title: getMessages(await getLocale()).notFound.title, robots: { index: false, follow: true } };
}

// A server component on purpose: only plain markup and the storefront's own
// classes, nothing imported from a client module.
export default async function NotFound() {
  const locale = await getLocale();
  const m = getMessages(locale);
  return (
    <div className="store-container kv-notfound">
      <p className="eyebrow">404</p>
      <h1>{m.notFound.title}</h1>
      <p>{m.notFound.text}</p>
      <Link href="/" className="kv-btn kv-btn-primary">{m.notFound.cta}</Link>
      <Link href="/support" className="text-link">{policyContent[locale].help}</Link>
    </div>
  );
}
