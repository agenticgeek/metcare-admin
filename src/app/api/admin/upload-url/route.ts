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
    
    // GET THE ACTUAL ORIGIN DYNAMICALLY
    // This ensures it works for Vercel Preview URLs, Localhost, etc.
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    // Remove protocol and trailing slash for Cloudflare's allowedOrigins format
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
            cleanOrigin,
            'localhost:3000',
            'localhost:3001',
            'metcare-admin.vercel.app',
            'met-academy-admin.vercel.app'
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
      return NextResponse.json({ error: 'Cloudflare did not return upload headers' }, { status: 500 });
    }

    return NextResponse.json({ tusUploadUrl, uid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
