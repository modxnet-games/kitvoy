"use client";
import Link from "next/link";
import { Facebook, Instagram, MessageCircle, Music2 } from "lucide-react";
import { catalog } from "@/config/catalog";
import { policyLinks, storePolicies } from "@/config/policies";
import { BrandLogo } from "./brand-logo";

type FooterSocialProps = {
  whatsappEnabled: boolean; whatsappNumber: string; whatsappLink: string;
  facebookEnabled: boolean; facebookUrl: string;
  instagramEnabled: boolean; instagramUrl: string;
  tiktokEnabled: boolean; tiktokUrl: string;
};
export function Footer({ social, business }: { social?: FooterSocialProps; business?: { legalName: string; address: string } }) {
  const whatsapp = social?.whatsappLink || (social?.whatsappNumber ? "https://wa.me/" + social.whatsappNumber.replace(/[^0-9]/g, "") : "");
  const socials = [
    social?.facebookEnabled && social.facebookUrl && { href: social.facebookUrl, label: "Facebook", icon: Facebook },
    social?.instagramEnabled && social.instagramUrl && { href: social.instagramUrl, label: "Instagram", icon: Instagram },
    social?.tiktokEnabled && social.tiktokUrl && { href: social.tiktokUrl, label: "TikTok", icon: Music2 },
    social?.whatsappEnabled && whatsapp && { href: whatsapp, label: "WhatsApp", icon: MessageCircle },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Facebook }[];
  const { supportEmail } = storePolicies;
  return <footer className="kv-footer kv-on-dark"><div className="kv-wrap">
    <div className="kv-footer-grid kv-footer-grid--wide">
      <div className="kv-footer-brand"><Link href="/" className="kv-logo" aria-label="Kitvoy home"><BrandLogo light lazy /></Link><p>Useful little finds.<br />Shipped free, tracked to your door.</p></div>
      <nav aria-label="Shop"><h4>Shop</h4><ul>{catalog.map(p => <li key={p.slug}><Link href={p.path}>{p.shortName}</Link></li>)}<li><Link href="/support">Common questions</Link></li></ul></nav>
      <nav aria-label="Policies"><h4>Policies</h4><ul>{policyLinks.map(l => <li key={l.href}><Link href={l.href}>{l.label}</Link></li>)}<li><Link href="/support#contact">Contact</Link></li></ul></nav>
      {socials.length > 0 && <nav aria-label="Follow Kitvoy"><h4>Follow us</h4><ul>{socials.map(({ href, label, icon: Icon }) => <li key={label}><a href={href} target="_blank" rel="noreferrer"><Icon size={15} aria-hidden="true" />{label}</a></li>)}</ul></nav>}
    </div>
    <div className="kv-footer-legal">&copy; {new Date().getFullYear()} Kitvoy. All rights reserved. {business?.legalName && <>Kitvoy is operated by {business.legalName}{business.address && <>, {business.address}</>}. </>}Prices in USD. Support: <a href={"mailto:" + supportEmail}>{supportEmail}</a>. <a href="https://oussamahitte.com" target="_blank" rel="noreferrer">Design & development by oussamahitte.com</a></div>
  </div></footer>;
}
