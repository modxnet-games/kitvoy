import { getStoreSettings } from "@/lib/data/store-settings";
import { getLocale } from "@/lib/locale-server";
import { policyLinks } from "@/config/policies";
import { policyContent } from "@/config/policy-content";
import { parseMoroccanPhone, whatsappLink } from "@/lib/morocco";
import { Footer } from "./footer";

export async function FooterWrapper() {
  const [settings, locale] = await Promise.all([getStoreSettings(), getLocale()]);
  const copy = policyContent[locale];
  const phone = parseMoroccanPhone(settings.supportPhone);
  return (
    <Footer
      links={[...policyLinks.map((l) => ({ href: l.href, label: copy.docs[l.key].title })), { href: "/support", label: copy.help }]}
      contact={{
        whatsapp: settings.whatsappEnabled ? settings.whatsappLink || whatsappLink(settings.whatsappNumber) || "" : "",
        phone: settings.supportPhone ? { href: `tel:${phone?.e164 ?? settings.supportPhone}`, label: settings.supportPhone } : null,
        email: settings.supportEmail,
      }}
      socials={[
        settings.facebookEnabled && settings.facebookUrl ? { href: settings.facebookUrl, label: "Facebook" } : null,
        settings.instagramEnabled && settings.instagramUrl ? { href: settings.instagramUrl, label: "Instagram" } : null,
        settings.tiktokEnabled && settings.tiktokUrl ? { href: settings.tiktokUrl, label: "TikTok" } : null,
      ].filter((s): s is { href: string; label: string } => !!s)}
      business={{ legalName: settings.legalName, address: settings.businessAddress }}
    />
  );
}
