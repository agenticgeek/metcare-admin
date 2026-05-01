import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ videoId: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { videoId } = await params;
    const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
    const CF_STREAM_API_TOKEN = process.env.CF_STREAM_API_TOKEN;

    if (!CF_ACCOUNT_ID || !CF_STREAM_API_TOKEN) {
      return NextResponse.json({ error: 'Cloudflare not configured' }, { status: 500 });
    }

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/${videoId}`,
      {
        headers: {
          'Authorization': `Bearer ${CF_STREAM_API_TOKEN}`,
        },
      }
    );

    const cfData = await cfResponse.json();

    if (!cfData.success || !cfData.result) {
      return NextResponse.json({ error: 'Video not found' }, { status: 404 });
    }

    return NextResponse.json({
      duration: cfData.result.duration ? Math.round(cfData.result.duration) : null,
      status: cfData.result.status?.state || 'unknown',
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
