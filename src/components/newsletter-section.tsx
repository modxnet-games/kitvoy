"use client";

import { useState } from "react";
import { useLanguage } from "@/contexts/language-context";
import { Button } from "@/components/ui/button";

interface NewsletterSectionProps {
  title?: string;
  subtitle?: string;
}

export function NewsletterSection({ title, subtitle }: NewsletterSectionProps) {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const sectionTitle = title || t("home.newsletterTitle");
  const sectionSubtitle = subtitle || t("home.newsletterSubtitle");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus("loading");
    try {
      const res = await fetch("/api/subscribers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "newsletter" }),
      });

      if (res.ok) {
        setStatus("success");
        setEmail("");
        setTimeout(() => setStatus("idle"), 3000);
      } else {
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    } catch {
      setStatus("error");
      setTimeout(() => setStatus("idle"), 3000);
    }
  };

  return (
    <section className="border-t bg-gradient-to-b from-muted/40 to-background">
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="mx-auto max-w-xl text-center">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            {sectionTitle}
          </h2>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground sm:text-base">
            {sectionSubtitle}
          </p>
          <form
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center"
            onSubmit={handleSubmit}
          >
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("home.newsletterPlaceholder")}
              className="h-12 rounded-xl border border-input bg-background px-5 text-sm outline-none transition-all placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/20 sm:min-w-[320px]"
              required
              disabled={status === "loading"}
            />
            <Button
              type="submit"
              size="lg"
              className="h-12 rounded-xl px-8 text-sm font-bold shadow-md"
              disabled={status === "loading"}
            >
              {status === "loading"
                ? "..."
                : status === "success"
                  ? "✓ Subscribed!"
                  : t("home.subscribe")}
            </Button>
          </form>
          {status === "success" && (
            <p className="mt-3 text-sm font-medium text-emerald-600">
              Thank you for subscribing!
            </p>
          )}
          {status === "error" && (
            <p className="mt-3 text-sm font-medium text-destructive">
              Something went wrong. Please try again.
            </p>
          )}
          <p className="mt-4 text-xs text-muted-foreground">
            {t("home.newsletterDisclaimer")}
          </p>
        </div>
      </div>
    </section>
  );
}
