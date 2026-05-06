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

    // Optimized: Update only if status is 'disabled' in a single round trip
    const { data: user, error: updateError } = await supabaseAdmin
      .from('users')
      .update({ status: 'active' })
      .eq('id', id)
      .eq('status', 'disabled')
      .select('id, status')
      .single();

    if (updateError) {
      if (updateError.code === 'PGRST116') { // No rows returned = condition not met
        return NextResponse.json(
          { error: 'User not found or not in disabled status' },
          { status: 400 }
        );
      }
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    return NextResponse.json(user);
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
