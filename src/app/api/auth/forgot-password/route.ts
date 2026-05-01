import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const { email } = await request.json();

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verify user exists and is active
    const { data: user, error: userError } = await supabaseAdmin
      .from('users')
      .select('id, full_name, status')
      .eq('email', normalizedEmail)
      .single();

    if (userError || !user) {
      // Return success even if not found to prevent email enumeration
      return NextResponse.json({ success: true });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'Account is not active' }, { status: 403 });
    }

    // Invalidate existing unused tokens
    await supabaseAdmin
      .from('activation_tokens')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false);

    // Generate reset token (72h expiry)
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    await supabaseAdmin.from('activation_tokens').insert({
      user_id: user.id,
      token,
      used: false,
      expires_at: expiresAt.toISOString(),
    });

    // Fire Resend email
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const resetUrl = `${baseUrl}/reset-password?token=${token}`;
      const firstName = user.full_name.split(' ')[0];

      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'MET Academy <noreply@met-academy.com>',
        to: normalizedEmail,
        subject: 'MET Academy — Réinitialisation de votre mot de passe',
        html: `
          <div style="font-family: 'Raleway', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="font-family: 'Poppins', sans-serif; color: #2B1517; font-size: 24px; margin: 0;">MET Academy</h1>
            </div>
            <p style="color: #2B1517; font-size: 16px;">Bonjour ${firstName},</p>
            <p style="color: #2B1517; font-size: 16px;">Vous avez demandé à réinitialiser votre mot de passe.</p>
            <div style="text-align: center; margin: 32px 0;">
              <a href="${resetUrl}" style="display: inline-block; background: #6A88A4; color: white; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-family: 'Poppins', sans-serif; font-weight: 600; font-size: 16px;">
                Réinitialiser mon mot de passe
              </a>
            </div>
            <p style="color: #6b6460; font-size: 14px;">Ce lien expire dans 72 heures.</p>
            <hr style="border: none; border-top: 1px solid #DECDBB; margin: 32px 0;" />
            <p style="color: #6b6460; font-size: 14px;">L'équipe MET Academy</p>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send reset email:', emailError);
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
