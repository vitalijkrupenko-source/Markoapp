import { db } from './db.js';
import { requireAdmin } from './auth.js';
import { getSettings } from './settings.js';
import { listWorkers, shiftsWithRequests } from './data.js';
import { isMonth, todayISO } from './dates.js';
import { UserError, json } from './http.js';

export function monthParam(value) {
  const month = value || todayISO().slice(0, 7);
  if (!isMonth(month)) throw new UserError('Neveljaven mesec.');
  return month;
}

/** Everything the admin screen needs for one month, in a single response. */
export async function adminState(client, month, extra = {}) {
  const [settings, workers, shifts] = await Promise.all([
    getSettings(client),
    listWorkers(client),
    shiftsWithRequests(client, { month }),
  ]);
  return json({ today: todayISO(), month, settings, workers, shifts, ...extra });
}

/** Runs an admin mutation and answers with the fresh state of `month`. */
export async function adminAction(month, fn) {
  await requireAdmin();
  const client = await db();
  const extra = (await fn(client)) || {};
  return adminState(client, monthParam(month), extra);
}
