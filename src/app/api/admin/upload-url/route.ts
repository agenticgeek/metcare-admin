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

    // CRITICAL: We must provide allowedOrigins to fix CORS for direct browser uploads
    const cfResponse = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CF_STREAM_API_TOKEN}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Length': uploadLength.toString(),
          'Upload-Metadata': 'name QWRtaW4gVmlkZW8=', // base64("Admin Video")
        },
        body: JSON.stringify({
          // This tells Cloudflare to allow these sites to upload directly
          allowedOrigins: [
            'localhost:3000',
            'localhost:3001',
            'https://metcare-admin-git-uzair-agentumais-projects.vercel.app',
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
