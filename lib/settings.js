import { rows } from './db.js';

export const DEFAULT_SETTINGS = {
  clinicName: 'Klinika',
  amStart: '08:00',
  amEnd: '14:00',
  pmStart: '14:00',
  pmEnd: '20:00',
  contactPhone: '',
};

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function getSettings(client) {
  const stored = rows(await client.execute('SELECT key, value FROM settings'));
  const settings = { ...DEFAULT_SETTINGS };
  for (const { key, value } of stored) {
    if (key in settings) settings[key] = value;
  }
  return settings;
}

/** Validates user input; returns the cleaned settings or throws a message meant for the user. */
export function cleanSettings(input) {
  const out = {};
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    const value = String(input?.[key] ?? '').trim();
    if (key.endsWith('Start') || key.endsWith('End')) {
      if (!TIME.test(value)) throw new Error('Čas vpišite v obliki 08:00.');
    }
    out[key] = value.slice(0, 80);
  }
  if (!out.clinicName) out.clinicName = DEFAULT_SETTINGS.clinicName;
  return out;
}
