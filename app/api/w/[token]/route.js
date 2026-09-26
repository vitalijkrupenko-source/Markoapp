import { db } from '@/lib/db';
import { setWorkerRequest, workerByToken, workerView } from '@/lib/data';
import { getSettings } from '@/lib/settings';
import { body, handle, json, UserError } from '@/lib/http';

export const dynamic = 'force-dynamic';

async function view(client, worker) {
  const [data, settings] = await Promise.all([workerView(client, worker), getSettings(client)]);
  const { clinicName, amStart, amEnd, pmStart, pmEnd, contactPhone } = settings;
  return json({ ...data, settings: { clinicName, amStart, amEnd, pmStart, pmEnd, contactPhone } });
}

async function load(ctx) {
  const { token } = await ctx.params;
  const client = await db();
  const worker = await workerByToken(client, token);
  if (!worker) throw new UserError('Ta povezava ne velja več. Obrnite se na kliniko.', 404);
  return { client, worker };
}

export const GET = handle(async (req, ctx) => {
  const { client, worker } = await load(ctx);
  return view(client, worker);
});

export const POST = handle(async (req, ctx) => {
  const { client, worker } = await load(ctx);
  const b = await body(req);
  await setWorkerRequest(client, worker, Number(b.shiftId), Boolean(b.want));
  return view(client, worker);
});
