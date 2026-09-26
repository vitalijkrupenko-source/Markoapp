import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminState, monthParam } from '@/lib/admin';
import { handle } from '@/lib/http';

export const dynamic = 'force-dynamic';

export const GET = handle(async (req) => {
  await requireAdmin();
  const month = monthParam(new URL(req.url).searchParams.get('month'));
  return adminState(await db(), month);
});
