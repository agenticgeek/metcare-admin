import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({
      authenticated: true,
      admin: { id: session.id, email: session.email },
    });
  } catch {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }
}
