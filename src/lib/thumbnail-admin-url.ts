import { supabaseAdmin } from '@/lib/supabase';
import { getThumbnailBucket, objectPathFromThumbnailPublicUrl } from '@/lib/storage-thumbnails';

/** Long-lived signed URL so admin `<img>` works even when the bucket is private. */
const SIGNED_URL_TTL_SEC = 60 * 60 * 24 * 7;

/**
 * URL safe for browser display in admin UI. Uses a signed URL when we can resolve
 * the Storage path; otherwise returns the stored value (e.g. external CDN URL).
 */
export async function thumbnailUrlForAdminDisplay(
  storedThumbnailUrl: string | null | undefined
): Promise<string | null> {
  if (!storedThumbnailUrl?.trim()) return null;

  const bucket = getThumbnailBucket();
  const path = objectPathFromThumbnailPublicUrl(storedThumbnailUrl);

  if (path) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .createSignedUrl(path, SIGNED_URL_TTL_SEC);

    if (!error && data?.signedUrl) {
      return data.signedUrl;
    }
    console.warn('[thumbnail] createSignedUrl failed:', error?.message);
  }

  return storedThumbnailUrl.trim();
}
