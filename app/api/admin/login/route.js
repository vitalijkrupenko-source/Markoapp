import { login, logout } from '@/lib/auth';
import { body, handle, json } from '@/lib/http';

export const POST = handle(async (req) => {
  const { password } = await body(req);
  await login(String(password ?? ''));
  return json({ ok: true });
});

export const DELETE = handle(async () => {
  await logout();
  return json({ ok: true });
});
