import { adminAction } from '@/lib/admin';
import { addWorker, deleteWorker, updateWorker } from '@/lib/data';
import { body, handle } from '@/lib/http';

export const POST = handle(async (req) => {
  const b = await body(req);
  return adminAction(b.month, (client) => addWorker(client, b));
});

export const PATCH = handle(async (req) => {
  const b = await body(req);
  return adminAction(b.month, (client) => updateWorker(client, Number(b.id), b));
});

export const DELETE = handle(async (req) => {
  const b = await body(req);
  return adminAction(b.month, (client) => deleteWorker(client, Number(b.id)));
});
