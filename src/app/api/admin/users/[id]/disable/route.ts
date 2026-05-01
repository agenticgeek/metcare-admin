import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/auth';

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

    // Validate: user exists, current status is 'active'
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, status')
      .eq('id', id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { error: 'Only active users can be disabled' },
        { status: 400 }
      );
    }

    // Update status to 'disabled'
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ status: 'disabled' })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ id, status: 'disabled' });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
