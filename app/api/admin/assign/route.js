import { adminAction } from '@/lib/admin';
import { approve, removeFromShift } from '@/lib/data';
import { body, handle } from '@/lib/http';

export const POST = handle(async (req) => {
  const b = await body(req);
  return adminAction(b.month, (client) => approve(client, Number(b.shiftId), Number(b.workerId)));
});

export const DELETE = handle(async (req) => {
  const b = await body(req);
  return adminAction(b.month, (client) => removeFromShift(client, Number(b.shiftId), Number(b.workerId)));
});
