"use client";
import Link from "next/link";
import { Facebook, Instagram, MessageCircle, Music2, ArrowUpRight } from "lucide-react";
import { catalog } from "@/config/catalog";
import { policyLinks } from "@/config/policies";
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
  return <footer className="store-footer"><div className="store-container">
    <div className="footer-top"><div className="footer-brand"><Link href="/" aria-label="Kitvoy home"><BrandLogo /></Link><p>Useful little finds.<br />Shipped free, tracked to your door.</p></div>
      <nav aria-label="Explore"><h2>Explore</h2><Link href="/products">All products</Link>{catalog.map(p => <Link key={p.slug} href={p.path}>{p.shortName}</Link>)}<Link href="/support">Common questions</Link></nav>
      <nav aria-label="Help and policies"><h2>Here to help</h2>{policyLinks.map(l => <Link key={l.href} href={l.href}>{l.label}</Link>)}<Link href="/support#contact">Contact</Link></nav>
      <nav aria-label="Your account"><h2>Your Kitvoy</h2><Link href="/account/orders">Track your order <ArrowUpRight size={14} /></Link><Link href="/account">My account</Link>{socials.map(({ href, label, icon: Icon }) => <a key={label} href={href} target="_blank" rel="noreferrer"><Icon size={15} />{label}</a>)}</nav>
    </div>
    <div className="footer-bottom">{business?.legalName && <p className="footer-identity">Kitvoy is operated by {business.legalName}{business.address && <>, {business.address}</>}.</p>}<p>© {new Date().getFullYear()} Kitvoy. All rights reserved.</p><span>Prices in USD</span><a href="https://oussamahitte.com" target="_blank" rel="noreferrer">Design & development by oussamahitte.com</a></div>
  </div></footer>;
}
