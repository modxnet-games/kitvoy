"use client";

import { useState, useTransition } from "react";
import { Check, Loader2 } from "lucide-react";

import type { StoreSocialSettings } from "@/lib/data/store-settings";
import { saveStoreSettingsAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface Props {
  settings: StoreSocialSettings;
}

export function StoreSettingsForm({ settings }: Props) {
  const [values, setValues] = useState<StoreSocialSettings>({ ...settings });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateField(
    name: keyof StoreSocialSettings,
    value: string | boolean,
  ) {
    setValues((prev) => ({ ...prev, [name]: value } as StoreSocialSettings));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError(null);

    const formData = new FormData();
    for (const [key, val] of Object.entries(values)) {
      if (typeof val === "boolean") {
        if (val) formData.set(key, "on");
      } else if (typeof val === "string") {
        formData.set(key, val);
      }
    }

    startTransition(async () => {
      try {
        const result = await saveStoreSettingsAction(formData);
        if (result.success) {
          setSaved(true);
          setTimeout(() => setSaved(false), 2500);
        }
      } catch {
        setError("Failed to save. Please try again.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold">WhatsApp contact</h2>
          <p className="text-sm text-muted-foreground">
            Configure the WhatsApp number or custom link used for the floating
            button and social icon.
          </p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="whatsappEnabled"
              checked={values.whatsappEnabled}
              onChange={(e) =>
                updateField("whatsappEnabled", e.target.checked)
              }
              className="size-4 rounded border-input accent-primary"
            />
            <label htmlFor="whatsappEnabled" className="text-sm font-medium">
              Enable WhatsApp contact
            </label>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label
                htmlFor="whatsappNumber"
                className="mb-1.5 block text-sm font-medium"
              >
                WhatsApp number
              </label>
              <Input
                id="whatsappNumber"
                name="whatsappNumber"
                value={values.whatsappNumber}
                onChange={(e) =>
                  updateField("whatsappNumber", e.target.value)
                }
                placeholder="+15555550123"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Used to generate a{" "}
                <span className="font-mono">https://wa.me/</span> link if no
                custom link is provided.
              </p>
            </div>
            <div>
              <label
                htmlFor="whatsappLink"
                className="mb-1.5 block text-sm font-medium"
              >
                Custom WhatsApp link (optional)
              </label>
              <Input
                id="whatsappLink"
                name="whatsappLink"
                value={values.whatsappLink}
                onChange={(e) =>
                  updateField("whatsappLink", e.target.value)
                }
                placeholder="https://wa.me/15555550123"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                If set, this link is used directly for WhatsApp buttons.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold">Social media</h2>
          <p className="text-sm text-muted-foreground">
            Control which social platforms appear in the footer and global
            UI.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="facebookEnabled"
                checked={values.facebookEnabled}
                onChange={(e) =>
                  updateField("facebookEnabled", e.target.checked)
                }
                className="size-4 rounded border-input accent-primary"
              />
              <label
                htmlFor="facebookEnabled"
                className="text-sm font-medium"
              >
                Show Facebook
              </label>
            </div>
            <Input
              id="facebookUrl"
              name="facebookUrl"
              value={values.facebookUrl}
              onChange={(e) =>
                updateField("facebookUrl", e.target.value)
              }
              placeholder="https://facebook.com/your-page"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="instagramEnabled"
                checked={values.instagramEnabled}
                onChange={(e) =>
                  updateField("instagramEnabled", e.target.checked)
                }
                className="size-4 rounded border-input accent-primary"
              />
              <label
                htmlFor="instagramEnabled"
                className="text-sm font-medium"
              >
                Show Instagram
              </label>
            </div>
            <Input
              id="instagramUrl"
              name="instagramUrl"
              value={values.instagramUrl}
              onChange={(e) =>
                updateField("instagramUrl", e.target.value)
              }
              placeholder="https://instagram.com/your-store"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="tiktokEnabled"
                checked={values.tiktokEnabled}
                onChange={(e) =>
                  updateField("tiktokEnabled", e.target.checked)
                }
                className="size-4 rounded border-input accent-primary"
              />
              <label htmlFor="tiktokEnabled" className="text-sm font-medium">
                Show TikTok
              </label>
            </div>
            <Input
              id="tiktokUrl"
              name="tiktokUrl"
              value={values.tiktokUrl}
              onChange={(e) =>
                updateField("tiktokUrl", e.target.value)
              }
              placeholder="https://www.tiktok.com/@your-store"
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border bg-card p-6">
        <div>
          <h2 className="text-lg font-semibold">Contact details</h2>
          <p className="text-sm text-muted-foreground">
            Optional contact info that can be surfaced in the footer or
            contact pages later.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="supportEmail"
              className="mb-1.5 block text-sm font-medium"
            >
              Support email
            </label>
            <Input
              id="supportEmail"
              name="supportEmail"
              type="email"
              value={values.supportEmail}
              onChange={(e) =>
                updateField("supportEmail", e.target.value)
              }
              placeholder="support@example.com"
            />
          </div>
          <div>
            <label
              htmlFor="supportPhone"
              className="mb-1.5 block text-sm font-medium"
            >
              Support phone
            </label>
            <Input
              id="supportPhone"
              name="supportPhone"
              value={values.supportPhone}
              onChange={(e) =>
                updateField("supportPhone", e.target.value)
              }
              placeholder="+15555550123"
            />
          </div>
        </div>
      </section>

      <div className="flex items-center gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Saving…
            </>
          ) : (
            "Save changes"
          )}
        </Button>
        {saved && (
          <span className="flex items-center gap-1 text-sm font-medium text-green-600">
            <Check className="size-4" />
            Saved
          </span>
        )}
        {error && (
          <span className="text-sm font-medium text-destructive">
            {error}
          </span>
        )}
      </div>
    </form>
  );
}

