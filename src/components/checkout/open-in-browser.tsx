"use client";

import { useState } from "react";

import { useLanguage } from "@/contexts/language-context";
import { externalBrowserUrl, inAppBrowserName, type InAppBrowser } from "@/lib/in-app-browser";

/**
 * "Having trouble in Facebook? Open in your browser." For a customer stuck in
 * an in-app browser: asks the server for a 15-minute link to this checkout,
 * hands it to the phone's real browser, and leaves the link on screen to copy
 * in case the app refuses to let go. The other browser lands straight on the
 * payment step, with nothing to retype.
 */
export function OpenInBrowser({ app, sessionToken, onOpen }: { app: InAppBrowser; sessionToken: string | null; onOpen?: () => void }) {
  const { t } = useLanguage();
  const [status, setStatus] = useState<"idle" | "loading" | "failed">("idle");
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const open = async () => {
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/checkout/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: sessionToken ?? undefined }),
      });
      const json = (await res.json().catch(() => null)) as { url?: unknown } | null;
      if (!res.ok || typeof json?.url !== "string") throw new Error("no link");
      setUrl(json.url);
      setStatus("idle");
      onOpen?.();
      window.location.href = externalBrowserUrl(json.url, navigator.userAgent);
    } catch {
      setStatus("failed");
    }
  };

  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      // No clipboard access in this web view: the link is selectable in the box
    }
  };

  if (url) {
    return (
      <div className="rounded-xl border border-[#e7e5df] bg-[#faf9f6] p-4 text-sm text-[#666a67]" data-open-in-browser="ready">
        <p>{t("checkout.openInBrowserHelp")}</p>
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={url}
            aria-label={t("checkout.openInBrowserLinkLabel")}
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 min-w-0 flex-1 rounded-lg border border-[#dcd9d0] bg-white px-3 text-xs text-[#171918]"
          />
          <button
            type="button"
            onClick={copy}
            className="inline-flex h-11 shrink-0 items-center rounded-lg border border-[#dcd9d0] bg-white px-4 text-sm font-semibold text-[#171918] transition-colors duration-200 hover:bg-[#f4f3ef] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c94b16]/40"
          >
            {copied ? t("checkout.copied") : t("checkout.copyLink")}
          </button>
        </div>
      </div>
    );
  }

  return (
    <p className="text-center text-xs text-[#666a67]">
      {status === "failed" && <span className="block pb-1 font-medium text-[#8f2a1f]">{t("checkout.openInBrowserFailed")}</span>}
      <button
        type="button"
        onClick={open}
        disabled={status === "loading"}
        data-open-in-browser="link"
        className="inline-flex min-h-11 items-center underline underline-offset-4 transition-colors duration-200 hover:text-[#171918] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c94b16]/40 disabled:opacity-60"
      >
        {t("checkout.openInBrowser", { app: inAppBrowserName[app] })}
      </button>
    </p>
  );
}
