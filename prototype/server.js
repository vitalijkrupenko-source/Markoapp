// The app's API, run in the browser on top of the shared store. Mirrors the
// rules in lib/data.js so the prototype behaves like the real app.

import { all, get, put, ready, remove } from './store';
import { shiftId } from './seed';
import { smartAssign } from '@/lib/assign';
import { statusFor } from '@/lib/status';
import { SLOT_LABEL, isISODate, isMonth, slotHours, todayISO } from '@/lib/dates';

const MAX_NEEDED = 10;
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEFAULT_SETTINGS = {
  clinicName: 'Klinika',
  amStart: '08:00',
  amEnd: '14:00',
  pmStart: '14:00',
  pmEnd: '20:00',
  contactPhone: '',
};

class HttpError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

// ---------- reads ----------

function settings() {
  return { ...DEFAULT_SETTINGS, ...(get('settings', 'main') || {}) };
}

function workers() {
  return all('workers')
    .map((w) => ({ id: w.id, name: w.name, phone: w.phone || '', token: w.token, active: w.active !== false }))
    .sort((a, b) => (a.active === b.active ? a.name.localeCompare(b.name, 'sl') : a.active ? -1 : 1));
}

function shifts({ month, from } = {}) {
  const byShift = new Map();
  for (const r of all('requests').sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))) {
    if (!byShift.has(r.shiftId)) byShift.set(r.shiftId, []);
    byShift.get(r.shiftId).push({ workerId: r.workerId, status: r.status });
  }
  return all('shifts')
    .filter((s) => (!month || s.date.startsWith(`${month}-`)) && (!from || s.date >= from))
    .sort((a, b) => (a.date === b.date ? (a.slot < b.slot ? -1 : 1) : a.date < b.date ? -1 : 1))
    .map((s) => ({ id: s.id, date: s.date, slot: s.slot, needed: s.needed, requests: byShift.get(s.id) || [] }));
}

function shiftById(id) {
  return all('shifts').find((s) => s.id === id);
}

const requestKey = (sId, wId) => `r_${sId}_${wId}`;
const approvedCount = (sId) => all('requests').filter((r) => r.shiftId === sId && r.status === 'approved').length;

function adminState(month, extra = {}) {
  return { today: todayISO(), month, settings: settings(), workers: workers(), shifts: shifts({ month }), ...extra };
}

function monthParam(value) {
  const month = value || todayISO().slice(0, 7);
  if (!isMonth(month)) throw new HttpError('Neveljaven mesec.');
  return month;
}

// ---------- admin actions ----------

function cleanWorker(input) {
  const name = String(input?.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const phone = String(input?.phone ?? '').trim().replace(/[^\d+ ]/g, '').slice(0, 20);
  if (!name) throw new HttpError('Vpišite ime.');
  return { name, phone };
}

function newToken() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  return [...bytes].map((b) => chars[b % chars.length]).join('');
}

async function addShifts({ dates, am, pm }) {
  if (!Array.isArray(dates) || !dates.length) throw new HttpError('Izberite vsaj en dan.');
  if (!dates.every(isISODate)) throw new HttpError('Neveljaven datum.');
  const counts = { am: Number(am) || 0, pm: Number(pm) || 0 };
  if (!counts.am && !counts.pm) throw new HttpError('Izberite, koliko ljudi potrebujete.');
  const skipped = new Set();
  for (const date of dates) {
    for (const slot of ['am', 'pm']) {
      const needed = counts[slot];
      if (!needed) continue;
      if (needed < 0 || needed > MAX_NEEDED) throw new HttpError('Neveljavno število ljudi.');
      const id = shiftId(date, slot);
      if (approvedCount(id) > needed) {
        skipped.add(date);
        continue;
      }
      await put('shifts', `s_${date}_${slot}`, { id, date, slot, needed });
    }
  }
  return { skipped: [...skipped] };
}

async function setNeeded(sId, needed) {
  needed = Number(needed);
  if (!Number.isInteger(needed) || needed < 0 || needed > MAX_NEEDED) throw new HttpError('Neveljavno število ljudi.');
  const shift = shiftById(sId);
  if (!shift) throw new HttpError('Termin ne obstaja več.', 404);
  const approved = approvedCount(sId);
  if (needed === 0) {
    if (approved > 0) throw new HttpError('Najprej odstranite potrjene osebe, nato izbrišite termin.');
    for (const r of all('requests').filter((x) => x.shiftId === sId)) await remove('requests', requestKey(sId, r.workerId));
    await remove('shifts', `s_${shift.date}_${shift.slot}`);
    return;
  }
  if (needed < approved) throw new HttpError(`Potrjenih oseb: ${approved}. Najprej koga odstranite.`);
  await put('shifts', `s_${shift.date}_${shift.slot}`, { ...shift, needed });
}

async function approve(sId, wId) {
  const shift = shiftById(sId);
  if (!shift) throw new HttpError('Termin ne obstaja več.', 404);
  const worker = all('workers').find((w) => w.id === wId);
  if (!worker) throw new HttpError('Oseba ne obstaja več.', 404);
  const other = all('requests').find((r) => {
    if (r.workerId !== wId || r.status !== 'approved' || r.shiftId === sId) return false;
    return shiftById(r.shiftId)?.date === shift.date;
  });
  if (other) {
    const slot = shiftById(other.shiftId).slot;
    throw new HttpError(`${worker.name} ta dan že dela (${SLOT_LABEL[slot].toLowerCase()}).`);
  }
  const existing = get('requests', requestKey(sId, wId));
  if (existing?.status === 'approved') return;
  if (approvedCount(sId) >= shift.needed) throw new HttpError('Termin je že poln.');
  await put('requests', requestKey(sId, wId), {
    shiftId: sId, workerId: wId, status: 'approved', createdAt: existing?.createdAt || new Date().toISOString(),
  });
}

// ---------- worker side ----------

function workerByToken(token) {
  const w = all('workers').find((x) => x.token === token);
  return w && w.active !== false ? w : null;
}

function workerView(worker) {
  const today = todayISO();
  const list = shifts({ from: `${today.slice(0, 7)}-01` });
  const approvedDates = new Set(
    list.filter((s) => s.requests.some((r) => r.workerId === worker.id && r.status === 'approved')).map((s) => s.date),
  );
  const { clinicName, amStart, amEnd, pmStart, pmEnd, contactPhone } = settings();
  return {
    today,
    worker: { name: worker.name },
    settings: { clinicName, amStart, amEnd, pmStart, pmEnd, contactPhone },
    shifts: list
      .map((s) => ({ id: s.id, date: s.date, slot: s.slot, status: statusFor(s, worker.id, approvedDates, today) }))
      .filter((s) => s.date >= today || s.status === 'approved'),
  };
}

async function setWorkerRequest(worker, sId, want) {
  const today = todayISO();
  const list = shifts({ from: today });
  const shift = list.find((s) => s.id === sId);
  if (!shift) throw new HttpError('Ta termin ni več na voljo.', 404);
  const mine = shift.requests.find((r) => r.workerId === worker.id);
  if (!want) {
    if (mine?.status === 'approved') throw new HttpError('Termin je že potrjen. Za odpoved pokličite kliniko.');
    await remove('requests', requestKey(sId, worker.id));
    return;
  }
  if (mine) return;
  const approvedDates = new Set(
    list.filter((s) => s.date === shift.date && s.requests.some((r) => r.workerId === worker.id && r.status === 'approved'))
      .map((s) => s.date),
  );
  const status = statusFor(shift, worker.id, approvedDates, today);
  if (status === 'full') throw new HttpError('Ta termin je že zaseden.');
  if (status === 'busy') throw new HttpError('Ta dan že delate.');
  await put('requests', requestKey(sId, worker.id), {
    shiftId: sId, workerId: worker.id, status: 'pending', createdAt: new Date().toISOString(),
  });
}

// ---------- router ----------

export async function route(method, path, body = {}) {
  await ready;
  const url = new URL(path, 'https://urnik.local');
  const p = url.pathname;

  const w = p.match(/^\/api\/w\/([^/]+)$/);
  if (w) {
    const worker = workerByToken(decodeURIComponent(w[1]));
    if (!worker) throw new HttpError('Ta povezava ne velja več. Obrnite se na kliniko.', 404);
    if (method === 'POST') await setWorkerRequest(worker, Number(body.shiftId), Boolean(body.want));
    return workerView(worker);
  }

  if (p === '/api/admin/login') return { ok: true };
  if (p === '/api/admin/state') return adminState(monthParam(url.searchParams.get('month')));

  const month = () => monthParam(body.month);
  const key = `${method} ${p}`;
  switch (key) {
    case 'POST /api/admin/shifts':
      return adminState(month(), await addShifts(body));
    case 'PATCH /api/admin/shifts':
      await setNeeded(Number(body.shiftId), body.needed);
      return adminState(month());
    case 'POST /api/admin/assign':
      await approve(Number(body.shiftId), Number(body.workerId));
      return adminState(month());
    case 'DELETE /api/admin/assign':
      await remove('requests', requestKey(Number(body.shiftId), Number(body.workerId)));
      return adminState(month());
    case 'POST /api/admin/smart': {
      const s = settings();
      const proposal = smartAssign({
        shifts: shifts({ month: month() }),
        hours: { am: slotHours(s, 'am'), pm: slotHours(s, 'pm') },
        activeWorkerIds: new Set(workers().filter((x) => x.active).map((x) => x.id)),
        today: todayISO(),
      });
      return { proposal };
    }
    case 'PUT /api/admin/smart': {
      if (!Array.isArray(body.proposal)) throw new HttpError('Ni predloga.');
      let saved = 0;
      for (const pr of body.proposal) {
        try {
          await approve(Number(pr.shiftId), Number(pr.workerId));
          saved += 1;
        } catch (err) {
          if (!(err instanceof HttpError)) throw err;
        }
      }
      return adminState(month(), { saved });
    }
    case 'POST /api/admin/workers': {
      const clean = cleanWorker(body);
      const id = Date.now() * 1000 + Math.floor(Math.random() * 1000);
      await put('workers', `w${id}`, { id, ...clean, token: newToken(), active: true });
      return adminState(month());
    }
    case 'PATCH /api/admin/workers': {
      const id = Number(body.id);
      const current = all('workers').find((x) => x.id === id);
      if (!current) throw new HttpError('Oseba ne obstaja več.', 404);
      await put('workers', `w${id}`, { ...current, ...cleanWorker(body), active: body.active !== false });
      return adminState(month());
    }
    case 'DELETE /api/admin/workers': {
      const id = Number(body.id);
      for (const r of all('requests').filter((x) => x.workerId === id)) await remove('requests', requestKey(r.shiftId, id));
      await remove('workers', `w${id}`);
      return adminState(month());
    }
    case 'PUT /api/admin/settings': {
      const out = {};
      for (const k of Object.keys(DEFAULT_SETTINGS)) {
        const v = String(body.settings?.[k] ?? '').trim();
        if ((k.endsWith('Start') || k.endsWith('End')) && !TIME.test(v)) throw new HttpError('Čas vpišite v obliki 08:00.');
        out[k] = v.slice(0, 80);
      }
      if (!out.clinicName) out.clinicName = DEFAULT_SETTINGS.clinicName;
      await put('settings', 'main', out);
      return adminState(month());
    }
    default:
      throw new HttpError('Neznana zahteva.', 404);
  }
}
