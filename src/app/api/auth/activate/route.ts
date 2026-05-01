import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import bcrypt from 'bcryptjs';

export async function POST(request: Request) {
  try {
    const { token, password } = await request.json();

    if (!token || !password || password.length < 8) {
      return NextResponse.json({ error: 'invalid_data' }, { status: 400 });
    }

    // 1. Find and validate token
    const { data: tokenData, error: tokenError } = await supabaseAdmin
      .from('activation_tokens')
      .select('user_id, expires_at, used')
      .eq('token', token)
      .single();

    if (tokenError || !tokenData) {
      return NextResponse.json({ error: 'invalid_token' }, { status: 404 });
    }

    // Check if user is already active
    const { data: userData } = await supabaseAdmin
      .from('users')
      .select('status')
      .eq('id', tokenData.user_id)
      .single();

    if (userData?.status === 'active') {
      return NextResponse.json({ error: 'already_active' }, { status: 400 });
    }

    if (tokenData.used) {
      return NextResponse.json({ error: 'token_replaced' }, { status: 400 });
    }

    if (new Date(tokenData.expires_at) < new Date()) {
      return NextResponse.json({ error: 'token_expired' }, { status: 400 });
    }

    // 2. Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // 3. Update user status and password
    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({
        status: 'active',
        password_hash: passwordHash
      })
      .eq('id', tokenData.user_id);

    if (userError) {
      return NextResponse.json({ error: 'update_failed' }, { status: 500 });
    }

    // 4. Mark token as used
    await supabaseAdmin
      .from('activation_tokens')
      .update({ used: true })
      .eq('token', token);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Activation error:', error);
    return NextResponse.json({ error: 'internal_error' }, { status: 500 });
  }
}
