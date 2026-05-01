import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/auth';
import crypto from 'crypto';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Verify user exists and is pending
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, status')
      .eq('id', id)
      .single();

    if (userError || !user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (user.status !== 'pending') {
      return NextResponse.json({ error: 'User is not pending' }, { status: 400 });
    }

    // Invalidate existing unused tokens for this user
    await supabaseAdmin
      .from('activation_tokens')
      .update({ used: true })
      .eq('user_id', id)
      .eq('used', false);

    // Generate new token with fresh 72h expiry
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    await supabaseAdmin.from('activation_tokens').insert({
      user_id: id,
      token,
      used: false,
      expires_at: expiresAt.toISOString(),
    });

    // Fire Resend email
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const activationUrl = `${baseUrl}/activate?token=${token}`;
      const firstName = user.full_name.split(' ')[0];

      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'MET Academy <noreply@met-academy.com>',
        to: user.email,
        subject: 'Bienvenue sur MET Academy — Activez votre accès',
        html: `
          <div style="font-family: 'Raleway', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-family: 'Poppins', sans-serif; color: #2B1517; font-size: 24px; margin: 0;">MET Academy</h1>
            </div>
            <p style="color: #2B1517; font-size: 16px;">Bonjour ${firstName},</p>
            <p style="color: #2B1517; font-size: 16px;">Votre accès à MET Academy est prêt.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${activationUrl}" style="display: inline-block; background: #6A88A4; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 16px;">
                Activer mon compte
              </a>
            </div>
            <p style="color: #6b6460; font-size: 14px;">Ce lien expire dans 72 heures.</p>
            <hr style="border: none; border-top: 1px solid #DECDBB; margin: 32px 0;" />
            <p style="color: #6b6460; font-size: 14px;">L'équipe MET Academy</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to resend activation email:', emailError);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
