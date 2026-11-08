import { supabase } from "@/integrations/supabase/client";

export const MEDIA_BUCKET = "xgram-media";
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

const signedUrlCache = new Map<string, { url: string; expires: number }>();

export function attachmentKind(mime: string | null | undefined) {
  if (!mime) return "file" as const;
  if (mime.startsWith("image/")) return "image" as const;
  if (mime.startsWith("video/")) return "video" as const;
  if (mime.startsWith("audio/")) return "audio" as const;
  return "file" as const;
}

export function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function uploadMedia(file: File, userId: string) {
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error("Files must be 25 MB or smaller.");
  }
  const safeName = file.name.replace(/[^\w.\-]/g, "_").slice(-80);
  const path = `${userId}/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from(MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  return { path, name: file.name, type: file.type || "application/octet-stream", size: file.size };
}

export async function getMediaUrl(path: string) {
  const cached = signedUrlCache.get(path);
  if (cached && cached.expires > Date.now()) return cached.url;
  const { data, error } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, 3600);
  if (error || !data) throw error ?? new Error("Could not load media");
  signedUrlCache.set(path, { url: data.signedUrl, expires: Date.now() + 3_000_000 });
  return data.signedUrl;
}

/** Drops a cached signed URL so the next read re-signs the object. */
export function invalidateMediaUrl(path: string) {
  signedUrlCache.delete(path);
}

/** Removes an object from storage; used to clean up a replaced profile photo. */
export async function removeMedia(path: string) {
  invalidateMediaUrl(path);
  await supabase.storage.from(MEDIA_BUCKET).remove([path]);
}
