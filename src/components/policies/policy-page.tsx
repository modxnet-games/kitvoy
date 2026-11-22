import type { Metadata } from "next";
import Link from "next/link";

import { mainProduct } from "@/config/catalog";
import { policyLinks, storePolicies, type PolicyKey } from "@/config/policies";
import { policyContent } from "@/config/policy-content";
import { siteConfig } from "@/config/site";
import { formatDate } from "@/lib/formatters";
import { interpolate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";

/** The terms that policy sentences quote: delivery hours and exchange days. */
export const policyTerms = {
  min: mainProduct.deliveryHours.min,
  max: mainProduct.deliveryHours.max,
  days: storePolicies.exchange.windowDays,
};

export async function policyMetadata(key: PolicyKey): Promise<Metadata> {
  const doc = policyContent[await getLocale()].docs[key];
  const path = policyLinks.find((l) => l.key === key)!.href;
  return { title: doc.title, description: interpolate(doc.description, policyTerms), alternates: { canonical: path } };
}

/** One policy page: title, effective date, the policy text, and links to the others. */
export async function PolicyPage({ policy }: { policy: PolicyKey }) {
  const locale = await getLocale();
  const copy = policyContent[locale];
  const doc = copy.docs[policy];
  const fill = (text: string) => interpolate(text, policyTerms);
  return (
    <article className="store-container support-page policy-page">
      <Link href="/support" className="text-link">{copy.help}</Link>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{doc.title}</h1>
      <p className="policy-updated">{interpolate(copy.effective, { date: formatDate(storePolicies.effectiveDate, locale) })}</p>
      <p className="support-intro">{fill(doc.intro)}</p>
      {doc.sections.map((section) => (
        <section key={section.id} aria-labelledby={section.id}>
          <h2 id={section.id}>{fill(section.heading)}</h2>
          {section.paragraphs?.map((p) => <p key={p}>{fill(p)}</p>)}
          {section.list && (
            <ul>
              {section.list.map((item) => <li key={item}>{fill(item)}</li>)}
            </ul>
          )}
        </section>
      ))}
      <section aria-labelledby="questions">
        <h2 id="questions">{copy.questions}</h2>
        <p>{copy.questionsText}</p>
      </section>
      <nav className="policy-nav" aria-label={siteConfig.name}>
        {policyLinks.filter((l) => l.key !== policy).map((l) => (
          <Link key={l.href} href={l.href} className="text-link">{copy.docs[l.key].title}</Link>
        ))}
        <Link href="/support" className="text-link">{copy.help}</Link>
      </nav>
    </article>
  );
}
