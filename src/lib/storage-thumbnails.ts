/** Supabase Storage bucket for module thumbnails (must match dashboard bucket name). */
export function getThumbnailBucket(): string {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_THUMBNAIL_BUCKET ||
    process.env.SUPABASE_THUMBNAIL_BUCKET ||
    'Thumbnail'
  );
}

/** Public URL for an object in a public bucket. Set bucket to public in Supabase → Storage → Policies. */
export function getThumbnailPublicUrl(objectPath: string): string | null {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const bucket = getThumbnailBucket();
  if (!base || !objectPath) return null;
  const pathEncoded = objectPath
    .split('/')
    .filter(Boolean)
    .map((seg) => encodeURIComponent(seg))
    .join('/');
  return `${base}/storage/v1/object/public/${encodeURIComponent(bucket)}/${pathEncoded}`;
}

/** Extract Storage object path from a saved public-style URL (used for remove + signed URLs). */
export function objectPathFromThumbnailPublicUrl(publicUrl: string | null | undefined): string | null {
  if (!publicUrl?.trim()) return null;
  const trimmed = publicUrl.trim().split('?')[0];
  const bucket = getThumbnailBucket();

  try {
    const u = new URL(trimmed);
    const parts = u.pathname.split('/').filter(Boolean);
    const pubIdx = parts.indexOf('public');
    if (pubIdx !== -1 && pubIdx + 2 < parts.length) {
      const bucketSeg = decodeURIComponent(parts[pubIdx + 1]);
      if (
        bucketSeg === bucket ||
        bucketSeg.toLowerCase() === bucket.toLowerCase()
      ) {
        return parts
          .slice(pubIdx + 2)
          .map((p) => decodeURIComponent(p))
          .join('/');
      }
    }
  } catch {
    /* fall through */
  }

  const markers = [
    `/storage/v1/object/public/${bucket}/`,
    `/storage/v1/object/public/${encodeURIComponent(bucket)}/`,
  ];
  for (const m of markers) {
    const i = trimmed.indexOf(m);
    if (i !== -1) {
      const tail = trimmed.slice(i + m.length);
      return tail.split('/').map((s) => decodeURIComponent(s)).join('/');
    }
  }
  return null;
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export function extensionFromMime(mime: string): string | null {
  return MIME_EXT[mime] ?? null;
}

export const THUMBNAIL_MAX_BYTES = 5 * 1024 * 1024;
