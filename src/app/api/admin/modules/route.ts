import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: modules, error } = await supabaseAdmin
      .from('modules')
      .select('id, order_index, title, description, video_id, duration_seconds, is_published, created_at')
      .order('order_index', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ modules });
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

    // Check for duplicate order_index
    const { data: existing } = await supabaseAdmin
      .from('modules')
      .select('id')
      .eq('order_index', order_index)
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'order_duplicate' },
        { status: 409 }
      );
    }

    // Insert module
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
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ module }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
