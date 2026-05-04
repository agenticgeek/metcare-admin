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

    if (!CF_ACCOUNT_ID) {
      return NextResponse.json({ error: 'Proxy Error: Missing CF_ACCOUNT_ID env' }, { status: 500 });
    }

    const uploadURL = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/media/${uid}?tusv2=true`;

    // Forward the PATCH to Cloudflare
    const cfResponse = await fetch(uploadURL, {
      method: 'PATCH',
      headers: {
        // REMOVED Authorization header - the tokenized URL should handle itself
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': offset || '0',
        'Content-Type': 'application/offset+octet-stream',
      },
      body: request.body,
      // @ts-ignore
      duplex: 'half',
    });

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text();
      console.error('[TUS-PROXY] Cloudflare Error:', cfResponse.status, errorText);
      return NextResponse.json({ 
        error: `Cloudflare ${cfResponse.status}`, 
        details: errorText // This will tell us EXACTLY why Cloudflare is rejecting it
      }, { status: cfResponse.status });
    }

    return new NextResponse(null, { status: 204 });
  } catch (err: any) {
    console.error('[TUS-PROXY] Server Error:', err);
    return NextResponse.json({ error: `Proxy Server Error: ${err.message}` }, { status: 500 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PATCH, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Upload-Offset, Tus-Resumable',
    },
  });
}
