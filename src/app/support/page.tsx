import Link from "next/link";
import { getStoreSettings } from "@/lib/data/store-settings";

export const metadata = { title: "Help & information" };
export const dynamic = "force-dynamic";

export default async function SupportPage() {
  const settings = await getStoreSettings();
  const whatsapp = settings.whatsappEnabled ? settings.whatsappLink || (settings.whatsappNumber ? `https://wa.me/${settings.whatsappNumber.replace(/[^0-9]/g, "")}` : "") : "";
  const hasContact = settings.supportEmail || settings.supportPhone || whatsapp;
  return <div className="store-container support-page"><Link href="/" className="text-link">Back to the store</Link><p className="eyebrow">Kitvoy support</p><h1>Help & information.</h1><p className="support-intro">The details available today, so you can make an informed choice.</p>
    <section id="shipping-returns"><h2>Shipping & returns</h2><p>Checkout currently accepts delivery addresses in the United States. Shipping charges for your selected products appear in your cart before checkout.</p><p>Delivery estimates, shipping exclusions, return eligibility, the return window, and a return address have not yet been published. Please confirm these details with the store before purchasing. No 30-day return guarantee is advertised here.</p><Link href="#contact" className="text-link">Contact information</Link></section>
    <section id="privacy"><h2>Privacy information</h2><p>A full privacy policy has not yet been published. This information is not a substitute for that policy.</p><p>The store keeps your cart in this browser. Checkout asks for contact and delivery information to create and fulfill an order. The available payment provider is shown at checkout. For questions about personal information, use the contact details below when available.</p></section>
    <section id="contact"><h2>Contact</h2>{settings.supportEmail && <p><a className="text-link" href={`mailto:${settings.supportEmail}`}>{settings.supportEmail}</a></p>}{settings.supportPhone && <p><a className="text-link" href={`tel:${settings.supportPhone.replace(/[^+0-9]/g, "")}`}>{settings.supportPhone}</a></p>}{whatsapp && <p><a className="text-link" href={whatsapp} target="_blank" rel="noreferrer">Contact on WhatsApp</a></p>}{!hasContact && <p>A customer-support email or phone number has not yet been published. Please check back before ordering if you need assistance.</p>}<p>Already have an account? <Link className="text-link" href="/account/orders">View your orders</Link>.</p></section>
  </div>;
}
