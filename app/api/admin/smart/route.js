import { requireAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { adminAction, monthParam } from '@/lib/admin';
import { smartAssign } from '@/lib/assign';
import { approve, listWorkers, shiftsWithRequests } from '@/lib/data';
import { getSettings } from '@/lib/settings';
import { slotHours, todayISO } from '@/lib/dates';
import { body, handle, json, UserError } from '@/lib/http';

// Returns a proposal only; nothing is saved until PUT.
export const POST = handle(async (req) => {
  await requireAdmin();
  const month = monthParam((await body(req)).month);
  const client = await db();
  const [settings, workers, shifts] = await Promise.all([
    getSettings(client), listWorkers(client), shiftsWithRequests(client, { month }),
  ]);
  const proposal = smartAssign({
    shifts,
    hours: { am: slotHours(settings, 'am'), pm: slotHours(settings, 'pm') },
    activeWorkerIds: new Set(workers.filter((w) => w.active).map((w) => w.id)),
    today: todayISO(),
  });
  return json({ proposal });
});

// Saves the proposal the admin confirmed.
export const PUT = handle(async (req) => {
  const b = await body(req);
  if (!Array.isArray(b.proposal)) throw new UserError('Ni predloga.');
  return adminAction(b.month, async (client) => {
    let saved = 0;
    for (const p of b.proposal.slice(0, 1000)) {
      try {
        await approve(client, Number(p.shiftId), Number(p.workerId));
        saved += 1;
      } catch (err) {
        if (!(err instanceof UserError)) throw err;
      }
    }
    return { saved };
  });
});
