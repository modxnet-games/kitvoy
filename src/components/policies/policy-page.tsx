import Link from "next/link";

import { policyLinks, storePolicies } from "@/config/policies";

/** Shared frame for the policy pages: title, effective date, the policy text, and links to the others. */
export function PolicyPage({ path, title, intro, children }: { path: string; title: string; intro: string; children: React.ReactNode }) {
  return (
    <article className="store-container support-page policy-page">
      <Link href="/support" className="text-link">Help & information</Link>
      <p className="eyebrow">Kitvoy policies</p>
      <h1>{title}</h1>
      <p className="policy-updated">Effective {storePolicies.effectiveDate}</p>
      <p className="support-intro">{intro}</p>
      {children}
      <section aria-labelledby="questions">
        <h2 id="questions">Questions</h2>
        <p>
          Email <a className="text-link" href={`mailto:${storePolicies.supportEmail}`}>{storePolicies.supportEmail}</a> and we&apos;ll get back to you.
        </p>
      </section>
      <nav className="policy-nav" aria-label="Store policies">
        {policyLinks.filter((l) => l.href !== path).map((l) => (
          <Link key={l.href} href={l.href} className="text-link">{l.label}</Link>
        ))}
      </nav>
    </article>
  );
}
