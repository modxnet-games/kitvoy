import type { Metadata } from "next";

import { storePolicies } from "@/config/policies";
import { PolicyPage } from "@/components/policies/policy-page";

const email = storePolicies.supportEmail;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Kitvoy collects, uses and protects your information when you shop, check out with Stripe or PayPal, or contact support.",
  alternates: { canonical: "/privacy" },
};

export default function PrivacyPolicyPage() {
  return (
    <PolicyPage path="/privacy" title="Privacy policy" intro="This policy explains what information Kitvoy collects when you visit kitvoy.com or place an order, how we use it, and the choices you have.">
      <section aria-labelledby="collect">
        <h2 id="collect">Information we collect</h2>
        <ul>
          <li><strong>Order details:</strong> your name, email address, phone number, delivery address and the items you buy.</li>
          <li><strong>Account details:</strong> if you create an account, your email address and a securely hashed password, or the basic profile Google shares if you sign in with Google.</li>
          <li><strong>Messages:</strong> anything you send us when you contact support.</li>
          <li><strong>Technical information:</strong> your IP address, browser and device type, which our hosting and security providers process to deliver and protect the site.</li>
          <li><strong>Ad measurement:</strong> the Meta Pixel records the pages you view on kitvoy.com, items added to the cart, the start of checkout and, when you place an order, the order total and items, along with cookie and device identifiers (see Cookies below). When you start checkout or complete an order, our server also sends Meta the same event with your email address, phone number, name, city, state and ZIP code in hashed (one-way encoded) form, plus your IP address, browser type and Meta&apos;s cookie identifiers, so Meta can match the sale to the ad that led to it.</li>
        </ul>
        <p>We don&apos;t collect or store your card or bank details. Payments are handled by Stripe and PayPal.</p>
      </section>
      <section aria-labelledby="use">
        <h2 id="use">How we use it</h2>
        <ul>
          <li>To process, ship and track your order: we email you an order confirmation when you buy, and a shipping confirmation with your tracking number once it ships.</li>
          <li>To handle returns, refunds and support requests.</li>
          <li>To run your account, if you have one.</li>
          <li>To prevent fraud, keep the store secure, and meet legal and tax obligations.</li>
          <li>To measure our ads on Facebook and Instagram and show them to people likely to be interested, using the Meta Pixel.</li>
        </ul>
        <p>We don&apos;t sell your personal information for money. Sharing visit and purchase activity with Meta for advertising may count as &quot;sharing&quot; or targeted advertising under some state privacy laws; you can opt out as described under Cookies.</p>
      </section>
      <section aria-labelledby="share">
        <h2 id="share">Who we share it with</h2>
        <p>We share information only with the services that help us run the store, and only what each one needs:</p>
        <ul>
          <li><strong>Stripe</strong> processes card and wallet payments under its own privacy policy.</li>
          <li><strong>PayPal</strong> processes PayPal payments under its own privacy policy.</li>
          <li><strong>Our fulfillment partner (CJdropshipping)</strong> receives your name, delivery address, phone number and order items to pack and ship your order.</li>
          <li><strong>Email and notification providers</strong> (Brevo, and Google Firebase for our team&apos;s order alerts) deliver order confirmation, shipping and support emails and notify us of new orders.</li>
          <li><strong>Hosting and security providers</strong> (including Cloudflare) host the site and protect it from abuse.</li>
          <li><strong>Google</strong>, if you choose to sign in with Google.</li>
          <li><strong>Meta Platforms</strong> receives page-view, add-to-cart, checkout and purchase events from the Meta Pixel and from our server (the Conversions API), including hashed contact details and your IP address, to measure and target our ads, and uses them under its own privacy policy.</li>
        </ul>
        <p>We may also disclose information when the law requires it. Some of these providers may process information outside the United States.</p>
      </section>
      <section aria-labelledby="cookies">
        <h2 id="cookies">Cookies and browser storage</h2>
        <p>We use essential cookies to keep you signed in and to hold a checkout you have started, and your browser&apos;s local storage to remember your cart. While you fill in the checkout, what you type is kept in your browser so a reload doesn&apos;t wipe it; once your order is created only a random checkout code and your order reference stay there, for up to 48 hours or until you pay.</p>
        <p>We also use the Meta Pixel, an advertising tool that sets cookies and sends Meta the pages you visit here, items you add to the cart and, when you buy, the order total and items; our server sends Meta the checkout and purchase events as well, with hashed contact details (see above). If you arrive from an ad, we keep the ad&apos;s campaign tags and Meta&apos;s click identifier in a first-party cookie for 30 days and record them with your order, so we know which ad brought you. We don&apos;t load the pixel on our admin pages, and we don&apos;t load it at all if your browser sends a Global Privacy Control signal. You can also opt out by blocking third-party cookies in your browser, by changing your ad preferences in your Facebook or Instagram settings, or by emailing <a className="text-link" href={`mailto:${email}`}>{email}</a>.</p>
      </section>
      <section aria-labelledby="keep">
        <h2 id="keep">How long we keep it</h2>
        <p>We keep order records for as long as we need them for orders, returns, accounting and tax. You can ask us to delete your account at any time; we&apos;ll keep only what the law requires us to.</p>
      </section>
      <section aria-labelledby="rights">
        <h2 id="rights">Your choices and rights</h2>
        <p>You can ask to see, correct or delete the personal information we hold about you by emailing <a className="text-link" href={`mailto:${email}`}>{email}</a>. Depending on where you live, including California, you may have additional rights under state privacy laws. We&apos;ll respond as those laws require and won&apos;t treat you differently for using them.</p>
      </section>
      <section aria-labelledby="security">
        <h2 id="security">Security</h2>
        <p>The site uses encrypted HTTPS connections, passwords are stored hashed, and access to order data is limited to the people who run the store. No system is perfectly secure, but we work to protect your information.</p>
      </section>
      <section aria-labelledby="children">
        <h2 id="children">Children</h2>
        <p>Kitvoy is not directed to children under 13, and we don&apos;t knowingly collect their information.</p>
      </section>
      <section aria-labelledby="changes">
        <h2 id="changes">Changes to this policy</h2>
        <p>If we change this policy, we&apos;ll update it here and change the effective date above.</p>
      </section>
    </PolicyPage>
  );
}
