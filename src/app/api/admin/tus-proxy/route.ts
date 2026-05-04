import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function PATCH(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const tusUrl = searchParams.get('tusUrl');
    const supabasePath = searchParams.get('supabasePath');
    const offset = request.headers.get('upload-offset');
    
    if (!tusUrl || !supabasePath) {
      return NextResponse.json({ error: 'Proxy Error: Missing tusUrl or supabasePath' }, { status: 400 });
    }

    const CF_STREAM_API_TOKEN = process.env.CF_STREAM_API_TOKEN;

    // 1. Fetch the chunk from Supabase Storage
    const { data, error } = await supabaseAdmin.storage
      .from('temp-video-chunks')
      .download(supabasePath);

    if (error || !data) {
      return NextResponse.json({ error: 'Proxy Error: Failed to fetch chunk from Supabase', details: error }, { status: 500 });
    }

    // 2. Forward the chunk to Cloudflare
    const cfResponse = await fetch(tusUrl, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${CF_STREAM_API_TOKEN}`,
        'Tus-Resumable': '1.0.0',
        'Upload-Offset': offset || '0',
        'Content-Type': 'application/offset+octet-stream',
      },
      body: data,
      // @ts-ignore
      duplex: 'half',
    });

    // 3. Cleanup: Delete the temporary chunk from Supabase
    await supabaseAdmin.storage.from('temp-video-chunks').remove([supabasePath]);

    if (!cfResponse.ok) {
      const errorText = await cfResponse.text();
      return NextResponse.json({ error: `Cloudflare ${cfResponse.status}`, details: errorText }, { status: cfResponse.status });
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
