import { rows } from './db.js';
import { UserError } from './http.js';
import { newToken } from './auth.js';
import { SLOT_LABEL, isISODate, todayISO } from './dates.js';
import { statusFor } from './status.js';

const MAX_NEEDED = 10;

// ---------- workers ----------

export async function listWorkers(client) {
  return rows(await client.execute(
    'SELECT id, name, phone, token, active FROM workers ORDER BY active DESC, name COLLATE NOCASE',
  )).map((w) => ({ ...w, active: Boolean(w.active) }));
}

function cleanWorker(input) {
  const name = String(input?.name ?? '').trim().replace(/\s+/g, ' ').slice(0, 60);
  const phone = String(input?.phone ?? '').trim().replace(/[^\d+ ]/g, '').slice(0, 20);
  if (!name) throw new UserError('Vpišite ime.');
  return { name, phone };
}

export async function addWorker(client, input) {
  const { name, phone } = cleanWorker(input);
  await client.execute({
    sql: 'INSERT INTO workers (name, phone, token) VALUES (?, ?, ?)',
    args: [name, phone, newToken()],
  });
}

export async function updateWorker(client, id, input) {
  const { name, phone } = cleanWorker(input);
  await client.execute({
    sql: 'UPDATE workers SET name = ?, phone = ?, active = ? WHERE id = ?',
    args: [name, phone, input.active === false ? 0 : 1, id],
  });
}

export async function deleteWorker(client, id) {
  await client.batch([
    { sql: 'DELETE FROM requests WHERE worker_id = ?', args: [id] },
    { sql: 'DELETE FROM workers WHERE id = ?', args: [id] },
  ], 'write');
}

// ---------- shifts ----------

/** All shifts whose date starts with `prefix` (a month 'YYYY-MM' or '' for all), with their requests. */
export async function shiftsWithRequests(client, { month, from } = {}) {
  const where = [];
  const args = [];
  if (month) { where.push('s.date LIKE ?'); args.push(`${month}-%`); }
  if (from) { where.push('s.date >= ?'); args.push(from); }
  const sql = `SELECT s.id, s.date, s.slot, s.needed, r.worker_id, r.status
    FROM shifts s LEFT JOIN requests r ON r.shift_id = s.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY s.date, s.slot, r.created_at, r.id`;
  const byId = new Map();
  for (const row of rows(await client.execute({ sql, args }))) {
    if (!byId.has(row.id)) {
      byId.set(row.id, { id: row.id, date: row.date, slot: row.slot, needed: row.needed, requests: [] });
    }
    if (row.worker_id != null) {
      byId.get(row.id).requests.push({ workerId: row.worker_id, status: row.status });
    }
  }
  return [...byId.values()];
}

async function approvedCount(client, shiftId) {
  const r = rows(await client.execute({
    sql: "SELECT COUNT(*) AS n FROM requests WHERE shift_id = ? AND status = 'approved'",
    args: [shiftId],
  }));
  return r[0].n;
}

/** Adds (or updates) shifts on many dates at once. A count of 0 leaves that slot untouched. */
export async function addShifts(client, { dates, am, pm }) {
  if (!Array.isArray(dates) || !dates.length) throw new UserError('Izberite vsaj en dan.');
  if (!dates.every(isISODate)) throw new UserError('Neveljaven datum.');
  const counts = { am: Number(am) || 0, pm: Number(pm) || 0 };
  if (!counts.am && !counts.pm) throw new UserError('Izberite, koliko ljudi potrebujete.');
  for (const n of Object.values(counts)) {
    if (!Number.isInteger(n) || n < 0 || n > MAX_NEEDED) throw new UserError('Neveljavno število ljudi.');
  }

  const skipped = [];
  for (const date of dates) {
    for (const slot of ['am', 'pm']) {
      const needed = counts[slot];
      if (!needed) continue;
      const existing = rows(await client.execute({
        sql: 'SELECT id FROM shifts WHERE date = ? AND slot = ?', args: [date, slot],
      }))[0];
      if (existing && (await approvedCount(client, existing.id)) > needed) {
        skipped.push(date);
        continue;
      }
      await client.execute({
        sql: `INSERT INTO shifts (date, slot, needed) VALUES (?, ?, ?)
              ON CONFLICT (date, slot) DO UPDATE SET needed = excluded.needed`,
        args: [date, slot, needed],
      });
    }
  }
  return { skipped: [...new Set(skipped)] };
}

export async function setNeeded(client, shiftId, needed) {
  needed = Number(needed);
  if (!Number.isInteger(needed) || needed < 0 || needed > MAX_NEEDED) throw new UserError('Neveljavno število ljudi.');
  const approved = await approvedCount(client, shiftId);
  if (needed === 0) {
    if (approved > 0) throw new UserError('Najprej odstranite potrjene osebe, nato izbrišite termin.');
    await client.batch([
      { sql: 'DELETE FROM requests WHERE shift_id = ?', args: [shiftId] },
      { sql: 'DELETE FROM shifts WHERE id = ?', args: [shiftId] },
    ], 'write');
    return;
  }
  if (needed < approved) throw new UserError(`Potrjenih oseb: ${approved}. Najprej koga odstranite.`);
  await client.execute({ sql: 'UPDATE shifts SET needed = ? WHERE id = ?', args: [needed, shiftId] });
}

// ---------- approvals ----------

export async function approve(client, shiftId, workerId) {
  const shift = rows(await client.execute({
    sql: 'SELECT id, date, slot, needed FROM shifts WHERE id = ?', args: [shiftId],
  }))[0];
  if (!shift) throw new UserError('Termin ne obstaja več.', 404);
  const worker = rows(await client.execute({
    sql: 'SELECT id, name FROM workers WHERE id = ?', args: [workerId],
  }))[0];
  if (!worker) throw new UserError('Oseba ne obstaja več.', 404);

  const other = rows(await client.execute({
    sql: `SELECT s.slot FROM requests r JOIN shifts s ON s.id = r.shift_id
          WHERE r.worker_id = ? AND r.status = 'approved' AND s.date = ? AND s.id <> ?`,
    args: [workerId, shift.date, shiftId],
  }))[0];
  if (other) {
    throw new UserError(`${worker.name} ta dan že dela (${SLOT_LABEL[other.slot].toLowerCase()}).`);
  }

  // Insert or promote the request, but only while there is still a free spot.
  const res = await client.execute({
    sql: `INSERT INTO requests (shift_id, worker_id, status)
          SELECT ?, ?, 'approved'
          WHERE (SELECT COUNT(*) FROM requests WHERE shift_id = ? AND status = 'approved') < ?
          ON CONFLICT (shift_id, worker_id) DO UPDATE SET status = 'approved'`,
    args: [shiftId, workerId, shiftId, shift.needed],
  });
  if (res.rowsAffected === 0) throw new UserError('Termin je že poln.');
}

export async function removeFromShift(client, shiftId, workerId) {
  await client.execute({
    sql: 'DELETE FROM requests WHERE shift_id = ? AND worker_id = ?', args: [shiftId, workerId],
  });
}

// ---------- worker side ----------

export async function workerByToken(client, token) {
  if (typeof token !== 'string' || token.length > 64) return null;
  const w = rows(await client.execute({
    sql: 'SELECT id, name, active FROM workers WHERE token = ?', args: [token],
  }))[0];
  return w && w.active ? w : null;
}

export async function workerView(client, worker) {
  const today = todayISO();
  const monthStart = `${today.slice(0, 7)}-01`;
  const shifts = await shiftsWithRequests(client, { from: monthStart });
  const approvedDates = new Set(
    shifts.filter((s) => s.requests.some((r) => r.workerId === worker.id && r.status === 'approved'))
      .map((s) => s.date),
  );
  return {
    today,
    worker: { name: worker.name },
    shifts: shifts
      .map((s) => ({ id: s.id, date: s.date, slot: s.slot, status: statusFor(s, worker.id, approvedDates, today) }))
      // Past days only matter for the worker's own hours this month.
      .filter((s) => s.date >= today || s.status === 'approved'),
  };
}

export async function setWorkerRequest(client, worker, shiftId, want) {
  const today = todayISO();
  const shift = (await shiftsWithRequests(client, { from: today })).find((s) => s.id === shiftId);
  if (!shift) throw new UserError('Ta termin ni več na voljo.', 404);
  const mine = shift.requests.find((r) => r.workerId === worker.id);

  if (!want) {
    if (mine?.status === 'approved') {
      throw new UserError('Termin je že potrjen. Za odpoved pokličite kliniko.');
    }
    await removeFromShift(client, shiftId, worker.id);
    return;
  }
  if (mine) return;
  const approvedDates = new Set(
    (await shiftsWithRequests(client, { from: shift.date }))
      .filter((s) => s.date === shift.date && s.requests.some((r) => r.workerId === worker.id && r.status === 'approved'))
      .map((s) => s.date),
  );
  const status = statusFor(shift, worker.id, approvedDates, today);
  if (status === 'full') throw new UserError('Ta termin je že zaseden.');
  if (status === 'busy') throw new UserError('Ta dan že delate.');
  await client.execute({
    sql: "INSERT INTO requests (shift_id, worker_id, status) VALUES (?, ?, 'pending') ON CONFLICT DO NOTHING",
    args: [shiftId, worker.id],
  });
}
