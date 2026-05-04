import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Read URL from Query Params instead of headers (more stable on Vercel)
    const { searchParams } = new URL(request.url);
    const uploadURL = searchParams.get('url');
    const offset = request.headers.get('upload-offset');
    
    if (!uploadURL) {
      console.error('[TUS-PROXY] Error: Missing url query parameter');
      return NextResponse.json({ error: 'Missing upload URL' }, { status: 400 });
    }

    const body = await request.arrayBuffer();
    const CF_STREAM_API_TOKEN = process.env.CF_STREAM_API_TOKEN;

    let attempts = 0;
    let cfResponse;
    
    while (attempts < 3) {
      attempts++;
      cfResponse = await fetch(uploadURL, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${CF_STREAM_API_TOKEN}`,
          'Tus-Resumable': '1.0.0',
          'Upload-Offset': offset || '0',
          'Content-Type': 'application/offset+octet-stream',
        },
        body: body,
      });

      if (cfResponse.status !== 520) break;
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!cfResponse || !cfResponse.ok) {
      const errorText = await cfResponse?.text();
      return NextResponse.json({ error: `Cloudflare Error: ${cfResponse?.status}`, details: errorText }, { status: cfResponse?.status || 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
