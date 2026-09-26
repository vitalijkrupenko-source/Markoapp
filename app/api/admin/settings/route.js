import { adminAction } from '@/lib/admin';
import { cleanSettings } from '@/lib/settings';
import { body, handle, UserError } from '@/lib/http';

export const PUT = handle(async (req) => {
  const b = await body(req);
  let settings;
  try {
    settings = cleanSettings(b.settings);
  } catch (err) {
    throw new UserError(err.message);
  }
  return adminAction(b.month, (client) => client.batch(
    Object.entries(settings).map(([key, value]) => ({
      sql: 'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      args: [key, value],
    })),
    'write',
  ).then(() => undefined));
});
