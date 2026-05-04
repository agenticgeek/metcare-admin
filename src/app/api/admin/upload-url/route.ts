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

    // Ensure the temporary buffer bucket exists in Supabase
    const { supabaseAdmin } = await import('@/lib/supabase');
    await supabaseAdmin.storage.createBucket('temp-video-chunks', {
      public: false,
      fileSizeLimit: 10 * 1024 * 1024,
    }).catch(() => {});

    const { uploadLength } = await request.json();
    const origin = request.headers.get('origin') || 'http://localhost:3000';
    const cleanOrigin = origin.replace(/^https?:\/\//, '').replace(/\/$/, '');

    // 1. Initiate the TUS upload
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
            origin,
            cleanOrigin,
            'localhost',
            'metcare-admin.vercel.app',
            'met-academy-admin.vercel.app',
            'metcare-admin-git-uzair-agentumais-projects.vercel.app'
          ],
        })
      }
    );

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text();
      return NextResponse.json({ error: `CF Error: ${cfResponse.status}`, details: errorText }, { status: cfResponse.status });
    }

    const uid = cfResponse.headers.get('stream-media-id');
    
    if (!uid) {
      return NextResponse.json({ error: 'No stream-media-id returned' }, { status: 500 });
    }

    // 2. CRITICAL: Construct the DIRECT URL instead of using the Gateway link
    // This bypasses the edge-production.gateway which is causing the CORS failures
    const tusUploadUrl = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/media/${uid}?tusv2=true`;

    return NextResponse.json({ tusUploadUrl, uid });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
