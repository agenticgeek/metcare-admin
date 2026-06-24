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

    // TUS protocol: POST with headers only, NO body. Cloudflare returns Location header.
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
      }
    );

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text();
      return NextResponse.json({ error: `CF Error: ${cfResponse.status}`, details: errorText }, { status: cfResponse.status });
    }

    const uid = cfResponse.headers.get('stream-media-id');
    const tusUploadUrl = cfResponse.headers.get('location');

    if (!uid) return NextResponse.json({ error: 'No stream-media-id returned' }, { status: 500 });
    if (!tusUploadUrl) {
      console.error('[upload-url] Missing location header from Cloudflare');
      return NextResponse.json({ error: 'No TUS location URL returned from Cloudflare' }, { status: 500 });
    }

    return NextResponse.json({ tusUploadUrl, uid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
