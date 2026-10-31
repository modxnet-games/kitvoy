import type { Metadata } from "next";

import { storePolicies } from "@/config/policies";
import { PolicyPage } from "@/components/policies/policy-page";

const email = storePolicies.supportEmail;

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Kitvoy collects, uses and protects your information when you shop, check out with PayPal, or contact support.",
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
        </ul>
        <p>We don&apos;t collect or store your card or bank details. Payments are handled by PayPal.</p>
      </section>
      <section aria-labelledby="use">
        <h2 id="use">How we use it</h2>
        <ul>
          <li>To process, ship and track your order: we email you an order confirmation when you buy, and a shipping confirmation with your tracking number once it ships.</li>
          <li>To handle returns, refunds and support requests.</li>
          <li>To run your account, if you have one.</li>
          <li>To prevent fraud, keep the store secure, and meet legal and tax obligations.</li>
        </ul>
        <p>We don&apos;t sell your personal information, and we don&apos;t use it for targeted advertising.</p>
      </section>
      <section aria-labelledby="share">
        <h2 id="share">Who we share it with</h2>
        <p>We share information only with the services that help us run the store, and only what each one needs:</p>
        <ul>
          <li><strong>PayPal</strong> processes your payment under its own privacy policy.</li>
          <li><strong>Our fulfillment partner (CJdropshipping)</strong> receives your name, delivery address, phone number and order items to pack and ship your order.</li>
          <li><strong>Email and notification providers</strong> (Brevo, and Google Firebase for our team&apos;s order alerts) deliver order confirmation, shipping and support emails and notify us of new orders.</li>
          <li><strong>Hosting and security providers</strong> (including Cloudflare) host the site and protect it from abuse.</li>
          <li><strong>Google</strong>, if you choose to sign in with Google.</li>
        </ul>
        <p>We may also disclose information when the law requires it. Some of these providers may process information outside the United States.</p>
      </section>
      <section aria-labelledby="cookies">
        <h2 id="cookies">Cookies and browser storage</h2>
        <p>We use essential cookies to keep you signed in, and your browser&apos;s local storage to remember your cart. We don&apos;t use advertising cookies or third-party analytics trackers.</p>
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
