"use client";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import { useLanguage } from "@/contexts/language-context";
import { BrandLogo } from "./brand-logo";

interface FooterProps {
  /** The policy pages and the help page, already named in the page's language */
  links: { href: string; label: string }[];
  /** Ways to reach the store, from admin > Settings > Store; empty ones are left out */
  contact: { whatsapp: string; phone: { href: string; label: string } | null; email: string };
  socials: { href: string; label: string }[];
  business: { legalName: string; address: string };
}

export function Footer({ links, contact, socials, business }: FooterProps) {
  const { t, m } = useLanguage();
  const hasContact = Boolean(contact.whatsapp || contact.phone || contact.email);
  return (
    <footer className="kv-footer kv-on-dark">
      <div className="kv-wrap">
        <div className="kv-footer-grid kv-footer-grid--wide">
          <div className="kv-footer-brand">
            <Link href="/" className="kv-logo kv-logo-stacked" aria-label={m.common.home}>
              <BrandLogo light lazy stacked />
            </Link>
            <p>{m.footer.tagline}</p>
          </div>
          <nav aria-label={m.footer.info}>
            <h4>{m.footer.info}</h4>
            <ul>
              {links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href}>{l.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
          {hasContact && (
            <nav aria-label={m.footer.contact}>
              <h4>{m.footer.contact}</h4>
              <ul>
                {contact.whatsapp && (
                  <li>
                    <a href={contact.whatsapp} target="_blank" rel="noreferrer">{m.footer.whatsapp}</a>
                  </li>
                )}
                {contact.phone && (
                  <li>
                    <a href={contact.phone.href} dir="ltr">{contact.phone.label}</a>
                  </li>
                )}
                {contact.email && (
                  <li>
                    <a href={"mailto:" + contact.email} dir="ltr">{contact.email}</a>
                  </li>
                )}
              </ul>
            </nav>
          )}
          {socials.length > 0 && (
            <nav aria-label={m.footer.follow}>
              <h4>{m.footer.follow}</h4>
              <ul>
                {socials.map((s) => (
                  <li key={s.label}>
                    <a href={s.href} target="_blank" rel="noreferrer">{s.label}</a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>
        <div className="kv-footer-legal">
          &copy; {new Date().getFullYear()} {siteConfig.name}. {m.footer.rights}{" "}
          {business.legalName && (
            <>
              {t("footer.operatedBy", { brand: siteConfig.name, name: business.legalName })}
              {business.address && <>, {business.address}</>}.{" "}
            </>
          )}
          {m.footer.prices} {m.footer.madeBy} <a href="https://oussamahitte.com" target="_blank" rel="noreferrer">oussamahitte.com</a>
        </div>
      </div>
    </footer>
  );
}
