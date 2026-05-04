import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const offset = request.headers.get('upload-offset');
    
    if (!uid) {
      return NextResponse.json({ error: 'Proxy Error: Missing video UID' }, { status: 400 });
    }

    const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID;
    const CF_STREAM_API_TOKEN = process.env.CF_STREAM_API_TOKEN;

    const uploadURL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/media/${uid}?tusv2=true`;

    // PIPELINE THE BODY DIRECTLY
    // This avoids memory issues and is more reliable for binary data
    const cfResponse = await fetch(uploadURL, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${CF_STREAM_API_TOKEN}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': offset || '0',
        'Content-Type': 'application/offset+octet-stream',
      },
      body: request.body,
      // @ts-ignore - required for streaming in some environments
      duplex: 'half',
    });

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text();
      console.error('[TUS-PROXY] Cloudflare Error:', cfResponse.status, errorText);
      // Return the ACTUAL error from Cloudflare to the browser
      return NextResponse.json({ 
        error: `Cloudflare ${cfResponse.status}`, 
        details: errorText 
      }, { status: cfResponse.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('[TUS-PROXY] Server Error:', err);
    return NextResponse.json({ error: `Proxy Server Error: ${err.message}` }, { status: 500 });
  }
}

// OPTIONS handler for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Upload-Offset, Tus-Resumable, x-upload-url',
    },
  });
}
