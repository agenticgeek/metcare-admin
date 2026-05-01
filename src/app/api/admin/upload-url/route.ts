import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

export async function POST() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
    const CF_STREAM_API_TOKEN = process.env.CF_STREAM_API_TOKEN;

    if (!CF_ACCOUNT_ID || !CF_STREAM_API_TOKEN) {
      return NextResponse.json(
        { error: 'Cloudflare Stream not configured' },
        { status: 500 }
      );
    }

    // Call Cloudflare Stream Direct Upload API
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream/direct_upload`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_STREAM_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          maxDurationSeconds: 7200, // 2 hour cap
        }),
      }
    );

    const cfData = await cfResponse.json();

    if (!cfData.success) {
      console.error('Cloudflare Direct Upload error:', cfData.errors);
      return NextResponse.json(
        { error: 'Failed to generate upload URL' },
        { status: 500 }
      );
    }

    // Return uploadURL and uid — NEVER return API token or account ID
    return NextResponse.json({
      uploadURL: cfData.result.uploadURL,
      uid: cfData.result.uid,
    });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
