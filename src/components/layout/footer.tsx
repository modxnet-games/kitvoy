/* eslint-disable react/jsx-no-target-blank */
"use client";

import Link from "next/link";
import {
  Facebook,
  Instagram,
  MessageCircle,
  Music2,
} from "lucide-react";

import { siteConfig } from "@/config/site";
import { useLanguage } from "@/contexts/language-context";
import { Separator } from "@/components/ui/separator";
import { BrandLogo } from "@/components/layout/brand-logo";

const footerLinks = {
  shop: [
    { key: "newArrivals", href: "/new-arrivals" },
    { key: "bestSellers", href: "/best-sellers" },
    { key: "sale", href: "/sale" },
    { key: "collections", href: "/collections" },
  ],
  company: [
    { key: "aboutUs", href: "/about" },
    { key: "careers", href: "/careers" },
    { key: "press", href: "/press" },
    { key: "blog", href: "/blog" },
  ],
  support: [
    { key: "contactUs", href: "/contact" },
    { key: "shippingReturns", href: "/shipping" },
    { key: "faq", href: "/faq" },
    { key: "sizeGuide", href: "/size-guide" },
  ],
  legal: [
    { key: "privacyPolicy", href: "/privacy" },
    { key: "termsOfService", href: "/terms" },
    { key: "cookiePolicy", href: "/cookies" },
  ],
};

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
  const { t } = useLanguage();

  const whatsappHref =
    social && social.whatsappEnabled
      ? buildWhatsappHref(social.whatsappLink, social.whatsappNumber)
      : null;

  return (
    <footer className="border-t bg-muted/30">
      <div className="container mx-auto px-4 py-12 md:py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
          {/* Brand */}
          <div className="col-span-2 md:col-span-4 lg:col-span-1">
            <Link href="/" className="inline-block">
              <BrandLogo />
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              {siteConfig.description}
            </p>
          </div>

          {/* Links */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">
              {t("footer.shop")}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {footerLinks.shop.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t(`footer.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">
              {t("footer.company")}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {footerLinks.company.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t(`footer.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider">
              {t("footer.support")}
            </h3>
            <ul className="mt-4 space-y-2.5">
              {footerLinks.support.map((link) => (
                <li key={link.key}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {t(`footer.${link.key}`)}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} {siteConfig.name}.{" "}
            {t("footer.allRightsReserved")}
          </p>
          <div className="flex items-center gap-6">
            {/* Social icons */}
            <div className="flex items-center gap-3">
              {social?.facebookEnabled && social.facebookUrl && (
                <Link
                  href={social.facebookUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Facebook className="size-5" />
                </Link>
              )}
              {social?.instagramEnabled && social.instagramUrl && (
                <Link
                  href={social.instagramUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Instagram"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Instagram className="size-5" />
                </Link>
              )}
              {social?.tiktokEnabled && social.tiktokUrl && (
                <Link
                  href={social.tiktokUrl}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="TikTok"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <Music2 className="size-5" />
                </Link>
              )}
              {whatsappHref && (
                <Link
                  href={whatsappHref}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WhatsApp"
                  className="text-muted-foreground transition-colors hover:text-foreground"
                >
                  <MessageCircle className="size-5" />
                </Link>
              )}
            </div>

            {/* Legal links */}
            <div className="flex gap-4">
              {footerLinks.legal.map((link) => (
                <Link
                  key={link.key}
                  href={link.href}
                  className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                >
                  {t(`footer.${link.key}`)}
                </Link>
              ))}
            </div>
          </div>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <a
            href="https://oussamahitte.com"
            target="_blank"
            rel="noopener noreferrer"
            className="transition-colors hover:text-foreground"
          >
            Designed &amp; Developed by oussamahitte.com
          </a>
        </p>
        </div>
      </div>
    </footer>
  );
}
