import type { Metadata } from "next";
import Link from "next/link";
import { deliveryText, processingText, storePolicies } from "@/config/policies";
import { getStoreSettings } from "@/lib/data/store-settings";

export const metadata: Metadata = {
  title: "Help, Shipping & Contact",
  description: "Free US shipping, 30-day returns, privacy and contact details for the Kitvoy cordless tire inflator store.",
  alternates: { canonical: "/support" },
};
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const settings = await getStoreSettings();
  const whatsapp = settings.whatsappEnabled ? settings.whatsappLink || (settings.whatsappNumber ? `https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, "")}` : "") : "";
  const hasContact = settings.supportEmail || settings.supportPhone || whatsapp;
  return <div className="store-container support-page"><Link href="/" className="text-link">Back to the store</Link><p className="eyebrow">Kitvoy support</p><h1>Help & information.</h1><p className="support-intro">Shipping, returns, privacy and how to reach us.</p>
    <section id="shipping-returns"><h2>Shipping & returns</h2><p>Shipping is free on every order to {storePolicies.shipping.destinations}. Orders are processed in {processingText} and usually arrive {deliveryText} after they ship, with tracking.</p><p>You can return unused items in their original packaging within {storePolicies.returns.windowDays} days of delivery. If your order arrives damaged or defective, we&apos;ll replace it or refund you in full.</p><div className="support-policy-links"><Link href="/shipping" className="text-link">Shipping policy</Link><Link href="/returns" className="text-link">Returns & refunds</Link></div></section>
    <section id="privacy"><h2>Privacy & terms</h2><p>We use your details to process, ship and support your order, and the Meta Pixel to measure our ads (you can opt out; see the privacy policy). Payments are handled by PayPal, and we never sell your information for money.</p><div className="support-policy-links"><Link href="/privacy" className="text-link">Privacy policy</Link><Link href="/terms" className="text-link">Terms of service</Link></div></section>
    <section id="contact"><h2>Contact</h2>{settings.supportEmail && <p><a className="text-link" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></p>}{settings.supportPhone && <p><a className="text-link" href={`tel:${settings.supportPhone.replace(/[^+0-9]/g, "")}`}>{settings.supportPhone}</a></p>}{whatsapp && <p><a className="text-link" href={whatsapp} target="_blank" rel="noreferrer">Contact on WhatsApp</a></p>}{!hasContact && <p>A customer-support email or phone number has not yet been published. Please check back before ordering if you need assistance.</p>}<p>Already have an account? <Link className="text-link" href="/account/orders">View your orders</Link>.</p></section>
  </div>;
}
