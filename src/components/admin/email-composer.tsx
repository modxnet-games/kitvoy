"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Send } from "lucide-react";

import { ADMIN_SENDERS, formatSender, type AdminSenderId } from "@/config/mail-senders";
import { Input } from "@/components/ui/input";

const FIELD =
  "w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 text-base outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm";

interface EmailComposerProps {
  defaultTo?: string;
  defaultSubject?: string;
  /** Links the email to an order so it shows in that order's history */
  orderId?: string;
}

/** Writes and sends a branded customer email from the server (Brevo SMTP on the VPS). */
export function EmailComposer({ defaultTo = "", defaultSubject = "", orderId }: EmailComposerProps) {
  const router = useRouter();
  const [sender, setSender] = useState<AdminSenderId>("support");
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [body, setBody] = useState("");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [, startRefresh] = useTransition();

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFields({});
    setSentTo(null);
    setSending(true);
    try {
      const res = await fetch("/api/admin/emails/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sender, to, subject, body, orderId }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFields(json?.fields ?? {});
        setError(typeof json?.error === "string" ? json.error : "The email wasn't sent");
      } else {
        setSentTo(to);
        setBody("");
        if (!orderId) {
          setTo("");
          setSubject("");
        }
      }
      // Failed sends are logged too, so refresh either way
      startRefresh(() => router.refresh());
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const label = "text-sm font-medium";
  const fieldError = (name: string) =>
    fields[name] ? <p id={`${name}-error`} className="text-xs text-destructive">{fields[name]}</p> : null;

  return (
    <form onSubmit={send} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="email-from" className={label}>From</label>
          <select
            id="email-from"
            value={sender}
            onChange={(e) => setSender(e.target.value as AdminSenderId)}
            disabled={sending}
            className={`${FIELD} h-10`}
          >
            {(Object.keys(ADMIN_SENDERS) as AdminSenderId[]).map((id) => (
              <option key={id} value={id}>{formatSender(id)}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="email-to" className={label}>To</label>
          <Input
            id="email-to"
            type="email"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            placeholder="customer@example.com"
            autoComplete="off"
            disabled={sending}
            aria-invalid={!!fields.to}
            aria-describedby={fields.to ? "to-error" : undefined}
            className="h-10"
          />
          {fieldError("to")}
        </div>
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email-subject" className={label}>Subject</label>
        <Input
          id="email-subject"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          maxLength={200}
          disabled={sending}
          aria-invalid={!!fields.subject}
          aria-describedby={fields.subject ? "subject-error" : undefined}
          className="h-10"
        />
        {fieldError("subject")}
      </div>

      <div className="space-y-1.5">
        <label htmlFor="email-body" className={label}>Message</label>
        <textarea
          id="email-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={8}
          maxLength={20000}
          placeholder={"Hi …,\n\nThanks for your order. …"}
          disabled={sending}
          aria-invalid={!!fields.body}
          aria-describedby={fields.body ? "body-error" : "body-help"}
          className={`${FIELD} resize-y py-2 leading-relaxed`}
        />
        {fieldError("body") ?? (
          <p id="body-help" className="text-xs text-muted-foreground">
            Sent in the Kitvoy email layout with your name and address as the signature. Replies go to {ADMIN_SENDERS[sender].email}.
          </p>
        )}
        {fields.sender && <p className="text-xs text-destructive">{fields.sender}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={sending}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {sending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          Send email
        </button>
        {sentTo && (
          <p role="status" className="flex items-center gap-1.5 text-sm text-emerald-700">
            <CheckCircle2 className="size-4" /> Sent to {sentTo}
          </p>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  );
}
