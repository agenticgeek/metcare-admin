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

    const normalizedEmail = email.toLowerCase().trim();

    // Local dev only: skip DB when credentials match .env.local (never set these in production)
    const localEmail = process.env.LOCAL_ADMIN_EMAIL?.toLowerCase().trim();
    const localPassword = process.env.LOCAL_ADMIN_PASSWORD;
    if (
      process.env.NODE_ENV === 'development' &&
      localEmail &&
      localPassword &&
      normalizedEmail === localEmail &&
      password === localPassword
    ) {
      const token = signAdminJWT({
        id: '00000000-0000-4000-8000-000000000001',
        email: normalizedEmail,
        role: 'admin',
      });
      const cookieOptions = getSessionCookieOptions();
      const response = NextResponse.json({ success: true });
      response.cookies.set({ ...cookieOptions, value: token });
      return response;
    }

    // Fetch admin row by email from admins table
    const { data: admin, error } = await supabaseAdmin
      .from('admins')
      .select('id, email, password_hash')
      .eq('email', normalizedEmail)
      .single();

    if (error || !admin) {
      if (process.env.NODE_ENV === 'development' && error) {
        console.error('[admin/login] admins lookup failed:', error.message, error.code, error.details);
      }
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
  } catch (err) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[admin/login]', err);
    }
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
