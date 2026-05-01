import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const COOKIE_NAME = 'met_admin_session';

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only protect /admin/* routes (except /admin/login)
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const token = request.cookies.get(COOKIE_NAME)?.value;

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url));
    }

    try {
      const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);
      const { payload } = await jwtVerify(token, secret);

      // Must be admin role — student tokens must not pass
      if (payload.role !== 'admin') {
        return NextResponse.redirect(new URL('/admin/login', request.url));
      }

      return NextResponse.next();
    } catch {
      // Invalid or expired token
      const response = NextResponse.redirect(new URL('/admin/login', request.url));
      response.cookies.delete(COOKIE_NAME);
      return response;
    }
  }

  // If admin visits /admin/login with valid session, redirect to /admin
  if (pathname === '/admin/login') {
    const token = request.cookies.get(COOKIE_NAME)?.value;
    if (token) {
      try {
        const secret = new TextEncoder().encode(process.env.ADMIN_JWT_SECRET!);
        const { payload } = await jwtVerify(token, secret);
        if (payload.role === 'admin') {
          return NextResponse.redirect(new URL('/admin', request.url));
        }
      } catch {
        // Token invalid — let them see login page
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
