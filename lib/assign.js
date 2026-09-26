// "Pametna razporeditev": fills open spots from pending requests so that hours end up
// as equal as possible. Pure function, so it can be tested and previewed before saving.

function tieBreak(workerId, shiftId) {
  // Stable pseudo-random order so the same person doesn't always win ties.
  let h = 2166136261;
  for (const c of `${workerId}:${shiftId}`) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}

/**
 * @param {object} p
 * @param {{id:number,date:string,slot:'am'|'pm',needed:number,requests:{workerId:number,status:string}[]}[]} p.shifts
 *        every shift of the month (past ones count towards hours already worked)
 * @param {{am:number,pm:number}} p.hours  length of each slot in hours
 * @param {Set<number>} p.activeWorkerIds
 * @param {string} p.today  only shifts on or after this date are filled
 * @returns {{shiftId:number, workerId:number}[]}
 */
export function smartAssign({ shifts, hours, activeWorkerIds, today }) {
  const load = new Map();
  const busy = new Set();
  const asked = new Map();
  const add = (map, key, n) => map.set(key, (map.get(key) || 0) + n);

  for (const s of shifts) {
    for (const r of s.requests) {
      if (r.status === 'approved') {
        add(load, r.workerId, hours[s.slot]);
        busy.add(`${r.workerId}|${s.date}`);
      } else if (s.date >= today) {
        add(asked, r.workerId, 1);
      }
    }
  }

  const open = shifts
    .filter((s) => s.date >= today)
    .map((s) => ({
      shift: s,
      spots: s.needed - s.requests.filter((r) => r.status === 'approved').length,
      pending: s.requests
        .filter((r) => r.status === 'pending' && activeWorkerIds.has(r.workerId))
        .map((r) => r.workerId),
    }))
    .filter((o) => o.spots > 0 && o.pending.length > 0);

  const result = [];
  for (;;) {
    let best = null;
    let bestCandidates = null;
    for (const o of open) {
      if (o.spots <= 0) continue;
      const candidates = o.pending.filter((w) => !busy.has(`${w}|${o.shift.date}`));
      if (!candidates.length) continue;
      const slack = candidates.length - o.spots;
      const bestSlack = best && bestCandidates.length - best.spots;
      if (!best || slack < bestSlack || (slack === bestSlack && o.shift.date < best.shift.date)) {
        best = o;
        bestCandidates = candidates;
      }
    }
    if (!best) break;

    bestCandidates.sort((a, b) =>
      (load.get(a) || 0) - (load.get(b) || 0)
      || (asked.get(a) || 0) - (asked.get(b) || 0)
      || tieBreak(a, best.shift.id) - tieBreak(b, best.shift.id));
    const workerId = bestCandidates[0];

    result.push({ shiftId: best.shift.id, workerId });
    add(load, workerId, hours[best.shift.slot]);
    busy.add(`${workerId}|${best.shift.date}`);
    best.pending = best.pending.filter((w) => w !== workerId);
    best.spots -= 1;
  }
  return result;
}
