"use client";

import Link from "next/link";
import { Facebook, Instagram, MessageCircle, Music2, RotateCcw, ShieldCheck, Truck } from "lucide-react";

import { siteConfig } from "@/config/site";
import { BrandLogo } from "@/components/layout/brand-logo";

/** Only pages that exist: sections of the sales page plus order tracking. */
const FOOTER_LINKS = [
  { label: "How it works", href: "/#how" },
  { label: "Bundles", href: "/#bundles" },
  { label: "FAQ", href: "/#faq" },
  { label: "Track my order", href: "/account/orders" },
];

const GUARANTEES = [
  { icon: Truck, label: "Free US shipping" },
  { icon: ShieldCheck, label: "Secure checkout" },
  { icon: RotateCcw, label: "30-day money-back guarantee" },
];

type FooterSocialProps = {
  whatsappEnabled: boolean;
  whatsappNumber: string;
  whatsappLink: string;
  facebookEnabled: boolean;
  facebookUrl: string;
  instagramEnabled: boolean;
  instagramUrl: string;
  tiktokEnabled: boolean;
  tiktokUrl: string;
};

interface FooterProps {
  social?: FooterSocialProps;
}

function buildWhatsappHref(link?: string, number?: string): string | null {
  if (link && link.trim()) return link.trim();
  if (!number) return null;
  const digits = number.replace(/[^0-9]/g, "");
  if (!digits) return null;
  return `https://wa.me/${digits}`;
}

export function Footer({ social }: FooterProps) {
  const whatsappHref =
    social && social.whatsappEnabled
      ? buildWhatsappHref(social.whatsappLink, social.whatsappNumber)
      : null;

  const socials = [
    social?.facebookEnabled && social.facebookUrl && { href: social.facebookUrl, label: "Facebook", icon: Facebook },
    social?.instagramEnabled && social.instagramUrl && { href: social.instagramUrl, label: "Instagram", icon: Instagram },
    social?.tiktokEnabled && social.tiktokUrl && { href: social.tiktokUrl, label: "TikTok", icon: Music2 },
    whatsappHref && { href: whatsappHref, label: "WhatsApp", icon: MessageCircle },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Facebook }[];

  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto px-4 py-12 md:py-14">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs">
            <Link href="/" aria-label={`${siteConfig.name} home`}>
              <BrandLogo />
            </Link>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{siteConfig.description}</p>
          </div>

          <nav aria-label="Footer">
            <ul className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm font-medium sm:flex sm:gap-8">
              {FOOTER_LINKS.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-foreground/75 transition-colors hover:text-foreground">
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-2 border-t pt-6 text-xs text-muted-foreground">
          {GUARANTEES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex items-center gap-1.5">
              <Icon className="size-4 text-brand" />
              {label}
            </li>
          ))}
        </ul>

        <div className="mt-6 flex flex-col-reverse items-start justify-between gap-4 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.name}. All rights reserved.
            <span className="mx-2">·</span>
            <a
              href="https://oussamahitte.com"
              target="_blank"
              rel="noopener noreferrer"
              className="transition-colors hover:text-foreground"
            >
              Designed &amp; developed by oussamahitte.com
            </a>
          </p>
          {socials.length > 0 && (
            <div className="flex items-center gap-3">
              {socials.map(({ href, label, icon: Icon }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={label}
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Icon className="size-5" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
