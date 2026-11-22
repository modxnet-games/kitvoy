import type { Metadata } from "next";
import Link from "next/link";

import { policyLinks, storePolicies } from "@/config/policies";
import { policyContent } from "@/config/policy-content";
import { siteConfig } from "@/config/site";
import { policyTerms } from "@/components/policies/policy-page";
import { getStoreSettings } from "@/lib/data/store-settings";
import { interpolate } from "@/lib/i18n";
import { getLocale } from "@/lib/locale-server";
import { formatMoroccanPhone, parseMoroccanPhone, whatsappLink } from "@/lib/morocco";
import { getMessages } from "@/messages";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const { support } = policyContent[await getLocale()];
  return { title: support.title, description: support.description, alternates: { canonical: "/support" } };
}

/** Help: the store's promises in three lines, the policy pages, and the ways to reach the store (set in admin > Settings > Store). */
export default async function SupportPage() {
  const [settings, locale] = await Promise.all([getStoreSettings(), getLocale()]);
  const copy = policyContent[locale];
  const { support } = copy;
  const m = getMessages(locale);
  const whatsapp = settings.whatsappEnabled ? settings.whatsappLink || whatsappLink(settings.whatsappNumber) || "" : "";
  const phone = parseMoroccanPhone(settings.supportPhone);
  const hasContact = Boolean(whatsapp || settings.supportPhone || settings.supportEmail);
  return (
    <div className="store-container support-page">
      <Link href="/" className="text-link">{m.common.backToStore}</Link>
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1>{support.title}</h1>
      <p className="support-intro">{support.intro}</p>
      <section id="essentials">
        <h2>{support.quick}</h2>
        <ul>
          <li>{m.faq.payA}</li>
          <li>{interpolate(m.faq.deliveryA, policyTerms)}</li>
          <li>{interpolate(m.faq.exchangeA, { days: storePolicies.exchange.windowDays })}</li>
        </ul>
        <div className="policy-nav">
          {policyLinks.map((l) => (
            <Link key={l.href} href={l.href} className="text-link">{copy.docs[l.key].title}</Link>
          ))}
        </div>
      </section>
      <section id="contact">
        <h2>{support.contact}</h2>
        {hasContact ? <p>{support.contactIntro}</p> : <p>{support.noContact}</p>}
        {whatsapp && (
          <p>
            {support.whatsapp} : <a className="text-link" dir="ltr" href={whatsapp} target="_blank" rel="noreferrer">{settings.whatsappNumber || support.whatsapp}</a>
          </p>
        )}
        {settings.supportPhone && (
          <p>
            {support.phone} : <a className="text-link" dir="ltr" href={`tel:${phone?.e164 ?? settings.supportPhone}`}>{phone ? formatMoroccanPhone(phone.national) : settings.supportPhone}</a>
          </p>
        )}
        {settings.supportEmail && (
          <p>
            {support.email} : <a className="text-link" dir="ltr" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a>
          </p>
        )}
        {settings.legalName && (
          <p>
            {interpolate(copy.operatedBy, { brand: siteConfig.name, name: settings.legalName })}
            {settings.businessAddress && (
              <>
                <br />
                {settings.businessAddress}
              </>
            )}
          </p>
        )}
      </section>
    </div>
  );
}
