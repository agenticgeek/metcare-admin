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
    const origin = request.headers.get('origin') || 'http://localhost:3000';

    // Cloudflare allowedOrigins can be picky. We'll provide both with and without protocols.
    const cleanOrigin = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');

    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_STREAM_API_TOKEN}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': uploadLength.toString(),
          'Upload-Metadata': 'name QWRtaW4gVmlkZW8=',
        },
        body: JSON.stringify({
          allowedOrigins: [
            origin,         // e.g. "http://localhost:3000"
            cleanOrigin,    // e.g. "localhost:3000"
            'localhost',
            'metcare-admin.vercel.app',
            'met-academy-admin.vercel.app',
            'https://metcare-admin.vercel.app',
            'https://met-academy-admin.vercel.app'
          ],
        })
      }
    );

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text();
      return NextResponse.json({ error: `CF Error: ${cfResponse.status}`, details: errorText }, { status: cfResponse.status });
    }

    const uid = cfResponse.headers.get('stream-media-id');
    const tusUploadUrl = cfResponse.headers.get('location');

    if (!uid || !tusUploadUrl) {
      return NextResponse.json({ error: 'No upload URL returned' }, { status: 500 });
    }

    return NextResponse.json({ tusUploadUrl, uid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
