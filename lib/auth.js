import crypto from 'node:crypto';
import { cookies } from 'next/headers';
import { UserError } from './http.js';

const COOKIE = 'urnik_admin';

function password() {
  const pw = process.env.ADMIN_PASSWORD;
  if (pw) return pw;
  if (process.env.NODE_ENV === 'production') return null;
  return 'admin'; // local development only
}

function sessionValue(pw) {
  return crypto.createHmac('sha256', pw).update('urnik-admin-session-v1').digest('base64url');
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function login(input) {
  const pw = password();
  if (!pw) throw new UserError('Geslo ni nastavljeno (ADMIN_PASSWORD).', 500);
  if (!safeEqual(input, pw)) throw new UserError('Napačno geslo.', 401);
  const jar = await cookies();
  jar.set(COOKIE, sessionValue(pw), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function logout() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

export async function requireAdmin() {
  const pw = password();
  const jar = await cookies();
  const value = jar.get(COOKIE)?.value;
  if (!pw || !value || !safeEqual(value, sessionValue(pw))) {
    throw new UserError('Prijava je potrebna.', 401);
  }
}

export function newToken() {
  return crypto.randomBytes(12).toString('base64url');
}
