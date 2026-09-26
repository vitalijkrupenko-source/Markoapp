import { adminAction } from '@/lib/admin';
import { addShifts, setNeeded } from '@/lib/data';
import { body, handle } from '@/lib/http';

// Add shifts on several dates at once.
export const POST = handle(async (req) => {
  const b = await body(req);
  return adminAction(b.month, (client) => addShifts(client, b));
});

// Change how many people one shift needs (0 deletes it).
export const PATCH = handle(async (req) => {
  const b = await body(req);
  return adminAction(b.month, (client) => setNeeded(client, Number(b.shiftId), b.needed));
});
