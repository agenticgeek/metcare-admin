import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { getAdminSession } from '@/lib/auth';
import crypto from 'crypto';

export async function GET() {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, full_name, email, status, created_at')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAdminSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { full_name, email } = await request.json();

    // Validate: full_name (min 2 chars)
    if (!full_name || full_name.trim().length < 2) {
      return NextResponse.json(
        { error: 'Name must be at least 2 characters', field: 'full_name' },
        { status: 400 }
      );
    }

    // Validate: email (valid format)
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return NextResponse.json(
        { error: 'Invalid email format', field: 'email' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Insert user directly and let unique constraint handle duplicates
    const { data: user, error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        full_name: full_name.trim(),
        email: normalizedEmail,
        status: 'pending',
        password_hash: '', 
      })
      .select('id, full_name, email, status, created_at')
      .single();

    if (insertError) {
      if (insertError.code === '23505') { // Unique constraint violation
        return NextResponse.json(
          { error: 'duplicate_email', field: 'email' },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // Generate cryptographically random token
    const token = crypto.randomBytes(32).toString('hex');

    // Insert activation token with 72h expiry
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 72);

    await supabaseAdmin.from('activation_tokens').insert({
      user_id: user.id,
      token,
      used: false,
      expires_at: expiresAt.toISOString(),
    });

    // Fire Resend welcome email
    try {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
      const activationUrl = `${baseUrl}/activate?token=${token}`;
      const firstName = full_name.trim().split(' ')[0];

      const { Resend } = await import('resend');
      const resend = new Resend(process.env.RESEND_API_KEY);

      await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || 'MET Academy <noreply@met-academy.com>',
        to: normalizedEmail,
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
      console.error('Failed to send activation email:', emailError);
      // Don't fail the user creation if email fails — log and continue
    }

    return NextResponse.json({ user }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
