"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Loader2, Upload } from "lucide-react";

import type { HomepageContent } from "@/lib/data/site-content";
import { normalizeMediaSrc } from "@/lib/media-url";
import { saveHomepageContentAction } from "./actions";
import { uploadImageViaAdminApi } from "@/lib/client/upload-image";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

interface Props {
  content: HomepageContent;
}

type FieldType = "text" | "textarea" | "toggle";

interface FieldDef {
  name: keyof HomepageContent;
  label: string;
  type: FieldType;
  placeholder?: string;
  hint?: string;
}

const SECTIONS: { title: string; description: string; fields: FieldDef[] }[] = [
  {
    title: "Announcement Bar",
    description: "Banner displayed at the top of every page.",
    fields: [
      { name: "announcementBarVisible", label: "Show announcement bar", type: "toggle" },
      { name: "announcementBar", label: "Announcement text", type: "text" },
    ],
  },
  {
    title: "Homepage Banner",
    description: "Main wide banner image on the homepage.",
    fields: [
      { name: "bannerVisible", label: "Show homepage banner", type: "toggle" },
      {
        name: "bannerImage",
        label: "Banner image",
        type: "text",
        placeholder: "/uploads/banners/banner-….jpg",
        hint: "Upload from your device (JPEG, PNG, or WebP, max 5MB). The path is set automatically.",
      },
    ],
  },
  {
    title: "Featured Products Section",
    description: "Section heading for the featured products grid.",
    fields: [
      { name: "featuredProductsVisible", label: "Show featured products", type: "toggle" },
      { name: "featuredTitle", label: "Section title", type: "text", placeholder: "Featured Products" },
      { name: "featuredSubtitle", label: "Section subtitle", type: "text", placeholder: "Handpicked favorites…" },
    ],
  },
  {
    title: "Newsletter Section",
    description: "Newsletter signup area at the bottom of the homepage.",
    fields: [
      { name: "newsletterSectionVisible", label: "Show newsletter section", type: "toggle" },
      { name: "newsletterTitle", label: "Section title", type: "text", placeholder: "Stay in the Loop" },
      { name: "newsletterSubtitle", label: "Section subtitle", type: "textarea" },
    ],
  },
];

export function HomepageContentForm({ content }: Props) {
  const [values, setValues] = useState<HomepageContent>({ ...content });
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [bannerPickPreview, setBannerPickPreview] = useState<string | null>(null);
  const [bannerPreviewRatio, setBannerPreviewRatio] = useState<number>(4 / 3);
  const [uploadOk, setUploadOk] = useState(false);
  const [showBannerPath, setShowBannerPath] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const bannerBlobRef = useRef<string | null>(null);

  function updateField(name: keyof HomepageContent, value: string | boolean) {
    setValues((prev) => ({ ...prev, [name]: value }));
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaved(false);
    setError(null);

    const formData = new FormData();
    for (const [key, val] of Object.entries(values)) {
      if (typeof val === "boolean") {
        if (val) formData.set(key, "on");
      } else {
        formData.set(key, val);
      }
    }

    startTransition(async () => {
      try {
        const result = await saveHomepageContentAction(formData);
        if (result.success) {
          setSaved(true);
          setTimeout(() => setSaved(false), 3000);
        }
      } catch {
        setError("Failed to save. Please try again.");
      }
    });
  };

  useEffect(() => {
    return () => {
      if (bannerBlobRef.current) {
        URL.revokeObjectURL(bannerBlobRef.current);
        bannerBlobRef.current = null;
      }
    };
  }, []);

  async function handleBannerUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setUploadOk(false);

    if (bannerBlobRef.current) {
      URL.revokeObjectURL(bannerBlobRef.current);
      bannerBlobRef.current = null;
    }
    const preview = URL.createObjectURL(file);
    bannerBlobRef.current = preview;
    setBannerPickPreview(preview);

    try {
      const result = await uploadImageViaAdminApi(file, "banner");
      if ("error" in result) {
        setError(result.error);
        setBannerPickPreview(null);
        if (bannerBlobRef.current) {
          URL.revokeObjectURL(bannerBlobRef.current);
          bannerBlobRef.current = null;
        }
      } else {
        updateField("bannerImage", result.url);
        setUploadOk(true);
        window.setTimeout(() => setUploadOk(false), 4000);
        // Keep blob preview briefly so there's no flash while the server path loads
        window.setTimeout(() => {
          setBannerPickPreview(null);
          if (bannerBlobRef.current) {
            URL.revokeObjectURL(bannerBlobRef.current);
            bannerBlobRef.current = null;
          }
        }, 500);
      }
    } catch {
      setError("Upload failed. Please try again.");
      setBannerPickPreview(null);
      if (bannerBlobRef.current) {
        URL.revokeObjectURL(bannerBlobRef.current);
        bannerBlobRef.current = null;
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {SECTIONS.map((section, idx) => (
        <div key={section.title}>
          {idx > 0 && <Separator className="mb-8" />}
          <div className="mb-4">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <p className="text-sm text-muted-foreground">{section.description}</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => {
              if (field.type === "toggle") {
                return (
                  <div key={field.name} className="flex items-center gap-3 sm:col-span-2">
                    <input
                      type="checkbox"
                      id={field.name}
                      checked={values[field.name] as boolean}
                      onChange={(e) => updateField(field.name, e.target.checked)}
                      className="size-4 rounded border-input accent-primary"
                    />
                    <label htmlFor={field.name} className="text-sm font-medium">
                      {field.label}
                    </label>
                  </div>
                );
              }

              if (field.name === "bannerImage") {
                const normalizedBanner = normalizeMediaSrc(
                  ((values.bannerImage as string) || "").trim(),
                );
                const displaySrc = bannerPickPreview || normalizedBanner;
                return (
                  <div key={field.name} className="space-y-2 sm:col-span-2">
                    <span className="mb-1.5 block text-sm font-medium">{field.label}</span>
                    <div className="rounded-lg border bg-muted/30 px-3 py-2">
                      {(values.bannerImage as string)?.trim() ? (
                        <code className="break-all text-xs text-muted-foreground">
                          {values.bannerImage as string}
                        </code>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          No banner image yet — upload one from your device.
                        </span>
                      )}
                    </div>
                    {field.hint && (
                      <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>
                    )}

                    <details
                      className="rounded-lg border bg-card/50 px-3 py-2 text-sm"
                      open={showBannerPath}
                    >
                      <summary
                        className="cursor-pointer font-medium text-muted-foreground hover:text-foreground"
                        onClick={(e) => {
                          e.preventDefault();
                          setShowBannerPath((o) => !o);
                        }}
                      >
                        Advanced: edit image path manually
                      </summary>
                      {showBannerPath && (
                        <input
                          id="bannerImage"
                          type="text"
                          value={values.bannerImage as string}
                          onChange={(e) => updateField("bannerImage", e.target.value)}
                          placeholder={field.placeholder}
                          className="mt-2 h-9 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50"
                        />
                      )}
                    </details>

                    <div className="mt-3 space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <input
                          ref={fileRef}
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/*"
                          className="hidden"
                          onChange={handleBannerUpload}
                          disabled={uploading}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => fileRef.current?.click()}
                          disabled={uploading}
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="mr-2 size-4 animate-spin" />
                              Uploading…
                            </>
                          ) : (
                            <>
                              <Upload className="mr-2 size-4" />
                              Upload banner from device
                            </>
                          )}
                        </Button>
                        {uploadOk && (
                          <span className="flex items-center gap-1 text-sm font-medium text-green-600">
                            <Check className="size-4" />
                            Banner uploaded — save changes to publish
                          </span>
                        )}
                      </div>
                      {displaySrc ? (
                        <div
                          className="relative w-full max-w-2xl overflow-hidden rounded-lg border bg-muted/30"
                          style={{ aspectRatio: String(bannerPreviewRatio) }}
                        >
                          {/* Plain <img>: avoids next/image optimizer issues with /uploads/ on production */}
                          <img
                            src={displaySrc}
                            alt="Banner preview"
                            className="size-full object-contain object-center"
                            onLoad={(e) => {
                              const img = e.currentTarget;
                              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                                const ratio = img.naturalWidth / img.naturalHeight;
                                const clamped = Math.min(Math.max(ratio, 0.7), 2.2);
                                setBannerPreviewRatio(clamped);
                              } else {
                                setBannerPreviewRatio(4 / 3);
                              }
                            }}
                          />
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={field.name}
                  className={field.type === "textarea" ? "sm:col-span-2" : ""}
                >
                  <label htmlFor={field.name} className="mb-1.5 block text-sm font-medium">
                    {field.label}
                  </label>
                  {field.type === "textarea" ? (
                    <textarea
                      id={field.name}
                      value={values[field.name] as string}
                      onChange={(e) => updateField(field.name, e.target.value)}
                      rows={3}
                      placeholder={field.placeholder}
                      className="w-full rounded-lg border border-input bg-transparent px-3 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                    />
                  ) : (
                    <input
                      id={field.name}
                      type="text"
                      value={values[field.name] as string}
                      onChange={(e) => updateField(field.name, e.target.value)}
                      placeholder={field.placeholder}
                      className="h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-base transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 md:text-sm"
                    />
                  )}
                  {field.hint && (
                    <p className="mt-1 text-xs text-muted-foreground">{field.hint}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <Separator />
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
            Saved successfully
          </span>
        )}
        {error && (
          <span className="text-sm font-medium text-destructive">{error}</span>
        )}
      </div>
    </form>
  );
}
