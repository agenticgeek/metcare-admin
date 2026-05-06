import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/auth';
import { thumbnailUrlForAdminDisplay } from '@/lib/thumbnail-admin-url';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: modules, error } = await supabaseAdmin
      .from('modules')
      .select(
        'id, order_index, title, description, video_id, duration_seconds, is_published, created_at, thumbnail_url'
      )
      .order('order_index', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const list = modules ?? [];
    const enriched = await Promise.all(
      list.map(async (m) => ({
        ...m,
        thumbnail_url: await thumbnailUrlForAdminDisplay(m.thumbnail_url),
      }))
    );

    return NextResponse.json({ modules: enriched });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { title, order_index, video_id, duration_seconds } = await request.json();

    // Validate required fields
    if (!title || title.trim().length === 0) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    if (order_index === undefined || order_index === null || !Number.isInteger(order_index)) {
      return NextResponse.json({ error: 'Order number must be an integer' }, { status: 400 });
    }

    if (!video_id) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    // Insert module directly and let unique constraint handle duplicates
    const { data: module, error: insertError } = await supabaseAdmin
      .from('modules')
      .insert({
        title: title.trim(),
        order_index,
        video_id,
        duration_seconds: duration_seconds || null,
      })
      .select()
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'order_duplicate' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ module }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
