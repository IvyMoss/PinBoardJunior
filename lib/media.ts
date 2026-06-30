import type { SupabaseClient } from "@supabase/supabase-js";

export const MEDIA_BUCKET = "idea-media";
export const ALLOWED_IMAGE_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
];
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Batch-sign storage paths into temporary URLs for rendering. The bucket is
 * private, so images are only ever served through short-lived signed URLs the
 * caller is authorized (by storage RLS) to mint. Returns a path → URL map.
 */
export async function signPaths(
  supabase: SupabaseClient,
  paths: string[],
  expiresIn = 3600,
): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return map;

  const { data } = await supabase.storage
    .from(MEDIA_BUCKET)
    .createSignedUrls(unique, expiresIn);

  for (const item of data ?? []) {
    if (item.path && item.signedUrl) map[item.path] = item.signedUrl;
  }
  return map;
}
