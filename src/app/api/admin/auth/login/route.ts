import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { verifyPassword, signAdminJWT, getSessionCookieOptions } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Fetch admin row by email from admins table
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('id, email, password_hash')
      .eq('email', email.toLowerCase().trim())
      .single();

    if (error || !admin) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Verify password using bcrypt
    const isValid = await verifyPassword(password, admin.password_hash);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Sign JWT with admin id + role='admin'
    const token = signAdminJWT({
      id: admin.id,
      email: admin.email,
      role: 'admin',
    });

    // Set httpOnly cookie
    const cookieOptions = getSessionCookieOptions();
    const response = NextResponse.json({ success: true });
    response.cookies.set({
      ...cookieOptions,
      value: token,
    });

    // Never return password_hash in any response
    return response;
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
