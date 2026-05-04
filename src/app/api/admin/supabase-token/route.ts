import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { supabaseAdmin } from '@/lib/supabase';

export async function GET(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const path = searchParams.get('path');

    if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 });

    // Generate a signed upload URL that expires in 10 minutes
    const { data, error } = await supabaseAdmin.storage
      .from('temp-video-chunks')
      .createSignedUploadUrl(path);

    if (error || !data) {
      return NextResponse.json({ error: 'Failed to generate signed URL', details: error }, { status: 500 });
    }

    return NextResponse.json({ signedUrl: data.signedUrl });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
