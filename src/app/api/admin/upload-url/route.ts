import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
    const CF_STREAM_API_TOKEN = process.env.CF_STREAM_API_TOKEN;

    if (!CF_ACCOUNT_ID || !CF_STREAM_API_TOKEN) {
      return NextResponse.json({ error: 'Cloudflare credentials missing' }, { status: 500 });
    }

    const { uploadLength } = await request.json();

    // Standard Direct Creator Upload request
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream?direct_user_upload=true`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_STREAM_API_TOKEN}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': uploadLength.toString(),
        },
        body: JSON.stringify({
          // Allowed origins for CORS (kept for redundancy)
          allowedOrigins: [
            'http://localhost:3000',
            'https://met-academy-admin.vercel.app',
          ],
          meta: { name: 'Admin Video' }
        })
      }
    );

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text();
      return NextResponse.json({ error: `CF Error: ${cfResponse.status}`, details: errorText }, { status: cfResponse.status });
    }

    // GET THE UID
    const uid = cfResponse.headers.get('stream-media-id');
    
    if (!uid) return NextResponse.json({ error: 'No media ID returned' }, { status: 500 });

    // CONSTRUCT DIRECT URL: This bypasses the edge-production.gateway which was failing with 520
    const uploadURL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/media/${uid}?tusv2=true`;

    return NextResponse.json({ uploadURL, uid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
