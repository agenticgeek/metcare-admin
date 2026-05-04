import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/auth';
import { getThumbnailBucket, objectPathFromThumbnailPublicUrl } from '@/lib/storage-thumbnails';
import { thumbnailUrlForAdminDisplay } from '@/lib/thumbnail-admin-url';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const titleRaw = body.title;
    const orderRaw = body.order_index;

    if (titleRaw === undefined && orderRaw === undefined) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }

    const updates: { title?: string; order_index?: number } = {};

    if (titleRaw !== undefined) {
      if (typeof titleRaw !== 'string' || !titleRaw.trim()) {
        return NextResponse.json({ error: 'Title is required' }, { status: 400 });
      }
      updates.title = titleRaw.trim();
    }

    if (orderRaw !== undefined) {
      if (!Number.isInteger(orderRaw)) {
        return NextResponse.json({ error: 'Order number must be an integer' }, { status: 400 });
      }

      const { data: conflict } = await supabaseAdmin
        .from('modules')
        .select('id')
        .eq('order_index', orderRaw)
        .neq('id', id)
        .maybeSingle();

      if (conflict) {
        return NextResponse.json({ error: 'order_duplicate' }, { status: 409 });
      }
      updates.order_index = orderRaw;
    }

    const { data: module, error: updateError } = await supabaseAdmin
      .from('modules')
      .update(updates)
      .eq('id', id)
      .select(
        'id, order_index, title, description, video_id, duration_seconds, is_published, created_at, thumbnail_url'
      )
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (!module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    const displayThumb = await thumbnailUrlForAdminDisplay(module.thumbnail_url);

    return NextResponse.json({
      module: { ...module, thumbnail_url: displayThumb ?? module.thumbnail_url },
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Fetch module row to get video_id
    const { data: module, error: fetchError } = await supabaseAdmin
      .from('modules')
      .select('id, video_id, thumbnail_url')
      .eq('id', id)
      .single();

    if (fetchError || !module) {
      return NextResponse.json({ error: 'Module not found' }, { status: 404 });
    }

    // Step 1: Delete from Cloudflare Stream FIRST
    if (module.video_id) {
      const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
      const CF_STREAM_API_TOKEN = process.env.CF_STREAM_API_TOKEN;

      if (CF_ACCOUNT_ID && CF_STREAM_API_TOKEN) {
        try {
          const cfResponse = await fetch(
            `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${module.video_id}`,
            {
              method: 'DELETE',
              headers: {
                'Authorization': `Bearer ${CF_STREAM_API_TOKEN}`,
              },
            }
          );

          if (!cfResponse.ok) {
            // If Cloudflare delete fails: do NOT delete from Supabase
            const cfError = await cfResponse.json().catch(() => ({}));
            console.error('Cloudflare delete failed:', module.video_id, cfError);
            return NextResponse.json(
              { error: 'Failed to delete video from Cloudflare Stream' },
              { status: 500 }
            );
          }
        } catch (cfErr) {
          console.error('Cloudflare delete error:', module.video_id, cfErr);
          return NextResponse.json(
            { error: 'Failed to delete video from Cloudflare Stream' },
            { status: 500 }
          );
        }
      }
    }

    const thumbPath = objectPathFromThumbnailPublicUrl(module.thumbnail_url);
    if (thumbPath) {
      const { error: thumbErr } = await supabaseAdmin.storage
        .from(getThumbnailBucket())
        .remove([thumbPath]);
      if (thumbErr) {
        console.error('Thumbnail storage delete failed:', module.thumbnail_url, thumbErr);
      }
    }

    // Step 2: Only if Cloudflare delete succeeds → DELETE from Supabase
    const { error: deleteError } = await supabaseAdmin
      .from('modules')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
