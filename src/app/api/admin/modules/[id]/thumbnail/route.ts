import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/auth';
import {
  extensionFromMime,
  getThumbnailBucket,
  getThumbnailPublicUrl,
  objectPathFromThumbnailPublicUrl,
  THUMBNAIL_MAX_BYTES,
} from '@/lib/storage-thumbnails';
import { thumbnailUrlForAdminDisplay } from '@/lib/thumbnail-admin-url';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: moduleId } = await params;

    const { data: moduleRow, error: fetchError } = await supabaseAdmin
      .from('modules')
      .select('id, thumbnail_url')
      .eq('id', moduleId)
      .single();

    if (fetchError || !moduleRow) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 });
    }

    if (file.size > THUMBNAIL_MAX_BYTES) {
      return NextResponse.json({ error: 'Image too large (max 5 MB)' }, { status: 400 });
    }

    const ext = extensionFromMime(file.type);
    if (!ext) {
      return NextResponse.json(
        { error: 'Unsupported image type. Use JPEG, PNG, WebP, or GIF.' },
        { status: 400 }
      );
    }

    const bucket = getThumbnailBucket();
    const objectPath = `${moduleId}/${randomUUID()}.${ext}`;
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    const oldPath = objectPathFromThumbnailPublicUrl(moduleRow.thumbnail_url);
    if (oldPath) {
      await supabaseAdmin.storage.from(bucket).remove([oldPath]);
    }

    const { error: uploadError } = await supabaseAdmin.storage.from(bucket).upload(objectPath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    if (uploadError) {
      console.error('[thumbnail upload]', uploadError);
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }

    const publicUrl = getThumbnailPublicUrl(objectPath);
    if (!publicUrl) {
      await supabaseAdmin.storage.from(bucket).remove([objectPath]);
      return NextResponse.json({ error: 'Could not build thumbnail URL' }, { status: 500 });
    }

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('modules')
      .update({ thumbnail_url: publicUrl })
      .eq('id', moduleId)
      .select(
        'id, order_index, title, description, video_id, duration_seconds, is_published, created_at, thumbnail_url'
      )
      .single();

    if (updateError || !updated) {
      await supabaseAdmin.storage.from(bucket).remove([objectPath]);
      return NextResponse.json({ error: updateError?.message ?? 'Update failed' }, { status: 500 });
    }

    const displayUrl = await thumbnailUrlForAdminDisplay(updated.thumbnail_url);

    return NextResponse.json({
      module: { ...updated, thumbnail_url: displayUrl ?? updated.thumbnail_url },
    });
  } catch (e) {
    console.error('[thumbnail]', e);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
