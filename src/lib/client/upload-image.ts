/**
 * Upload an image through the admin-only POST /api/upload endpoint.
 * Cookies are sent automatically for same-origin requests (admin session).
 */
export async function uploadImageViaAdminApi(
  file: File,
  type: "product" | "banner" | "category",
): Promise<{ url: string } | { error: string }> {
  const fd = new FormData();
  fd.set("file", file);
  fd.set("type", type);

  const uploadUrl =
    typeof window !== "undefined"
      ? new URL("/api/upload", window.location.origin).toString()
      : "/api/upload";

  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "POST",
      body: fd,
      credentials: "same-origin",
    });
  } catch {
    return { error: "Network error. Check your connection and try again." };
  }

  let data: { url?: string; error?: string };
  try {
    data = (await res.json()) as { url?: string; error?: string };
  } catch {
    return { error: "Invalid response from server." };
  }

  if (!res.ok) {
    return { error: data.error ?? `Upload failed (${res.status})` };
  }
  if (!data.url) {
    return { error: "No image URL returned from server." };
  }
  return { url: data.url };
}
