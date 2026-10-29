"use client";

import { useState } from "react";
import { Copy, Download, Check } from "lucide-react";

export function SubscriberActionsClient({ emails }: { emails: string[] }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(emails.join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const textarea = document.createElement("textarea");
      textarea.value = emails.join("\n");
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExport = () => {
    const csv =
      "Email\n" + emails.map((e) => `"${e}"`).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `subscribers_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (emails.length === 0) return null;

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCopy}
        className="inline-flex h-10 items-center gap-2 rounded-xl border border-input bg-background px-4 text-sm font-medium shadow-sm transition-all hover:bg-muted active:scale-[0.98]"
      >
        {copied ? (
          <>
            <Check className="size-4 text-emerald-600" />
            Copied!
          </>
        ) : (
          <>
            <Copy className="size-4" />
            Copy All
          </>
        )}
      </button>
      <button
        onClick={handleExport}
        className="inline-flex h-10 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 active:scale-[0.98]"
      >
        <Download className="size-4" />
        Export CSV
      </button>
    </div>
  );
}
