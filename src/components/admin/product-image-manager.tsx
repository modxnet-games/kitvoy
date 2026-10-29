"use client";

import { useEffect, useRef, useState } from "react";
import {
  Plus,
  X,
  ChevronUp,
  ChevronDown,
  Upload,
  Check,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { uploadImageViaAdminApi } from "@/lib/client/upload-image";
import { normalizeMediaSrc, isVideoMediaUrl } from "@/lib/media-url";
import { cn } from "@/lib/utils";

interface ProductImageManagerProps {
  value: string[];
  onChange: (urls: string[]) => void;
}

const ACCEPT_MEDIA =
  "image/jpeg,image/png,image/webp,video/mp4,video/webm,video/quicktime,.jpg,.jpeg,.png,.webp,.mp4,.webm,.mov";

function revokeAllBlobUrls(
  blobUrlsRef: React.MutableRefObject<Set<string>>,
  setLocalPreview: React.Dispatch<React.SetStateAction<Record<number, string>>>,
  setLocalIsVideo: React.Dispatch<React.SetStateAction<Record<number, boolean>>>,
) {
  setLocalPreview((prev) => {
    Object.values(prev).forEach((u) => {
      if (u.startsWith("blob:")) {
        URL.revokeObjectURL(u);
        blobUrlsRef.current.delete(u);
      }
    });
    return {};
  });
  setLocalIsVideo({});
}

function MediaThumbnail({
  url,
  localPreview,
  localIsVideo,
}: {
  url: string;
  localPreview?: string | null;
  /** When preview is a blob: URL, whether the picked file was a video */
  localIsVideo?: boolean;
}) {
  const [error, setError] = useState(false);
  const normalized = normalizeMediaSrc(url);
  const src = localPreview || normalized;
  const useVideo =
    Boolean(src) &&
    !error &&
    (localPreview
      ? localIsVideo === true
      : isVideoMediaUrl(normalized));

  useEffect(() => {
    setError(false);
  }, [url, localPreview]);

  return (
    <div className="relative aspect-square w-24 shrink-0 overflow-hidden rounded-lg border bg-muted sm:w-28">
      {src && !error ? (
        useVideo ? (
          <video
            src={src}
            muted
            playsInline
            preload="metadata"
            className="size-full object-cover"
            onError={() => setError(true)}
          />
        ) : (
          <img
            src={src}
            alt=""
            className="size-full object-cover"
            onError={() => setError(true)}
          />
        )
      ) : (
        <div className="flex size-full items-center justify-center text-muted-foreground/50">
          <span className="text-lg">?</span>
        </div>
      )}
    </div>
  );
}

export function ProductImageManager({ value, onChange }: ProductImageManagerProps) {
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccessIndex, setUploadSuccessIndex] = useState<number | null>(null);
  const [localPreview, setLocalPreview] = useState<Record<number, string>>({});
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [localIsVideo, setLocalIsVideo] = useState<Record<number, boolean>>({});
  const blobUrlsRef = useRef(new Set<string>());

  const urls = value.length > 0 ? value : [""];

  useEffect(() => {
    return () => {
      blobUrlsRef.current.forEach((u) => URL.revokeObjectURL(u));
      blobUrlsRef.current.clear();
    };
  }, []);

  function revokePreview(index: number) {
    setLocalPreview((prev) => {
      const next = { ...prev };
      const blob = next[index];
      if (blob) {
        URL.revokeObjectURL(blob);
        blobUrlsRef.current.delete(blob);
      }
      delete next[index];
      return next;
    });
    setLocalIsVideo((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });
  }

  function addImage() {
    onChange([...urls.filter(Boolean), ""]);
  }

  function removeImage(index: number) {
    const next = urls.filter((_, i) => i !== index);
    const finalNext = next.length > 0 ? next : [""];
    onChange(finalNext);

    setLocalPreview((prev) => {
      const blob = prev[index];
      if (blob) {
        URL.revokeObjectURL(blob);
        blobUrlsRef.current.delete(blob);
      }
      const reindexed: Record<number, string> = {};
      for (let ni = 0; ni < finalNext.length; ni++) {
        const oi = ni < index ? ni : ni + 1;
        if (oi !== index && prev[oi]) reindexed[ni] = prev[oi];
      }
      return reindexed;
    });
    setLocalIsVideo((prev) => {
      const reindexed: Record<number, boolean> = {};
      for (let ni = 0; ni < finalNext.length; ni++) {
        const oi = ni < index ? ni : ni + 1;
        if (oi !== index && prev[oi] !== undefined) reindexed[ni] = prev[oi];
      }
      return reindexed;
    });
  }

  function updateUrl(index: number, url: string) {
    const next = [...urls];
    next[index] = url;
    onChange(next);
  }

  function moveUp(index: number) {
    if (index <= 0) return;
    revokeAllBlobUrls(blobUrlsRef, setLocalPreview, setLocalIsVideo);
    const next = [...urls];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    onChange(next);
  }

  function moveDown(index: number) {
    if (index >= urls.length - 1) return;
    revokeAllBlobUrls(blobUrlsRef, setLocalPreview, setLocalIsVideo);
    const next = [...urls];
    [next[index], next[index + 1]] = [next[index + 1], next[index]];
    onChange(next);
  }

  function reorder(from: number, to: number) {
    if (from === to || from < 0 || to < 0) return;
    revokeAllBlobUrls(blobUrlsRef, setLocalPreview, setLocalIsVideo);
    const next = [...urls];
    const [removed] = next.splice(from, 1);
    next.splice(to, 0, removed);
    onChange(next);
  }

  async function handleUpload(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    setUploadSuccessIndex(null);

    const pickedIsVideo =
      file.type.startsWith("video/") ||
      /\.(mp4|webm|mov)$/i.test(file.name);
    setLocalIsVideo((prev) => ({ ...prev, [index]: pickedIsVideo }));

    const blobUrl = URL.createObjectURL(file);
    blobUrlsRef.current.add(blobUrl);
    setLocalPreview((prev) => {
      const next = { ...prev };
      if (next[index]) {
        URL.revokeObjectURL(next[index]);
        blobUrlsRef.current.delete(next[index]);
      }
      next[index] = blobUrl;
      return next;
    });

    setUploadingIndex(index);

    try {
      const result = await uploadImageViaAdminApi(file, "product");
      if ("error" in result) {
        setUploadError(result.error);
        revokePreview(index);
      } else {
        updateUrl(index, result.url);
        revokePreview(index);
        setUploadSuccessIndex(index);
        window.setTimeout(() => setUploadSuccessIndex((cur) => (cur === index ? null : cur)), 3500);
      }
    } catch {
      setUploadError("Upload failed. Please try again.");
      revokePreview(index);
    } finally {
      setUploadingIndex(null);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Upload <strong className="text-foreground">images</strong> (JPEG, PNG, WebP, max 5MB) or{" "}
        <strong className="text-foreground">videos</strong> (MP4, WebM, MOV, max 24MB). Drag the
        grip handle to reorder left/right in the list. Order here is the gallery order on the
        storefront. Paths save when you submit the product form.
      </p>
      {uploadError && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {uploadError}
        </p>
      )}
      <div className="space-y-3">
        {urls.map((url, i) => (
          <div
            key={`${i}-${url || "slot"}`}
            onDragOver={(e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              if (draggingIndex !== null && draggingIndex !== i) {
                setDragOverIndex(i);
              }
            }}
            onDragLeave={() => setDragOverIndex((cur) => (cur === i ? null : cur))}
            onDrop={(e) => {
              e.preventDefault();
              const from = draggingIndex;
              setDragOverIndex(null);
              setDraggingIndex(null);
              if (from === null || from === i) return;
              reorder(from, i);
            }}
            className={cn(
              "flex flex-wrap items-start gap-2 rounded-lg border bg-muted/30 p-3 transition-shadow sm:flex-nowrap sm:gap-3",
              dragOverIndex === i && draggingIndex !== i && "ring-2 ring-primary ring-offset-2",
            )}
          >
            <div
              className="flex shrink-0 cursor-grab touch-none items-center self-center active:cursor-grabbing"
              draggable={uploadingIndex === null}
              title="Drag to reorder"
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(i));
                setDraggingIndex(i);
              }}
              onDragEnd={() => {
                setDraggingIndex(null);
                setDragOverIndex(null);
              }}
            >
              <GripVertical className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <MediaThumbnail
              url={url}
              localPreview={localPreview[i]}
              localIsVideo={localIsVideo[i]}
            />
            <div className="min-w-0 flex-1 space-y-2">
              <input type="hidden" name="imageUrls" value={url} />
              {url ? (
                <div className="space-y-1">
                  <code
                    className="block max-w-full truncate rounded bg-muted/50 px-2 py-1 text-xs text-muted-foreground"
                    title={url}
                  >
                    {url}
                  </code>
                  {uploadSuccessIndex === i && (
                    <span className="flex items-center gap-1 text-xs font-medium text-green-600">
                      <Check className="size-3.5" />
                      Uploaded successfully
                    </span>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No file yet — use Upload to add an image or video.
                </p>
              )}
              <div className="flex flex-wrap items-center gap-1">
                <input
                  id={`product-image-upload-${i}`}
                  type="file"
                  accept={ACCEPT_MEDIA}
                  className="hidden"
                  onChange={(e) => handleUpload(i, e)}
                  disabled={uploadingIndex !== null}
                />
                <label
                  htmlFor={`product-image-upload-${i}`}
                  className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-md border border-input bg-background px-2.5 text-sm font-medium hover:bg-accent hover:text-accent-foreground ${
                    uploadingIndex !== null ? "cursor-not-allowed opacity-50" : ""
                  }`}
                >
                  <Upload className="size-3.5" />
                  {uploadingIndex === i
                    ? "Uploading…"
                    : url
                      ? "Replace image / video"
                      : "Upload image / video"}
                </label>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === 0}
                  onClick={() => moveUp(i)}
                  title="Move up"
                >
                  <ChevronUp className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={i === urls.length - 1}
                  onClick={() => moveDown(i)}
                  title="Move down"
                >
                  <ChevronDown className="size-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => removeImage(i)}
                  title="Remove"
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={addImage}>
          <Plus className="size-4" />
          Add media slot
        </Button>
      </div>
    </div>
  );
}
