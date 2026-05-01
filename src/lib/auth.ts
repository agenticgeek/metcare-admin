import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { cookies } from 'next/headers';

const ADMIN_JWT_SECRET = process.env.ADMIN_JWT_SECRET!;
const COOKIE_NAME = 'met_admin_session';

export interface AdminPayload {
  id: string;
  email: string;
  role: 'admin';
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signAdminJWT(payload: AdminPayload): string {
  return jwt.sign(payload, ADMIN_JWT_SECRET, { expiresIn: '7d' });
}

export function verifyAdminJWT(token: string): AdminPayload | null {
  try {
    return jwt.verify(token, ADMIN_JWT_SECRET) as AdminPayload;
  } catch {
    return null;
  }
}

export async function getAdminSession(): Promise<AdminPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyAdminJWT(token);
}

export function getSessionCookieOptions() {
  return {
    name: COOKIE_NAME,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict' as const,
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days
  };
}

export const COOKIE_NAME_EXPORT = COOKIE_NAME;
