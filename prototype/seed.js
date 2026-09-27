// Example data for the prototype: a clinic, five people and next month's first
// working days with some sign-ups, so every screen has something to show.

import { addMonths, daysInMonth, isWeekend, todayISO } from '../lib/dates.js';

export const EXAMPLE_PEOPLE = [
  ['Ana Novak', '041 000 001'],
  ['Bojan Kralj', '041 000 002'],
  ['Cvetka Zupan', '041 000 003'],
  ['Darja Horvat', '041 000 004'],
  ['Eva Kos', ''],
];

export function shiftId(date, slot) {
  return Number(date.replace(/-/g, '')) * 10 + (slot === 'am' ? 1 : 2);
}

export function exampleData(today = todayISO()) {
  const workers = {};
  EXAMPLE_PEOPLE.forEach(([name, phone], i) => {
    const id = i + 1;
    workers[`w${id}`] = { id, name, phone, token: `primer${id}`, active: true };
  });

  const month = addMonths(today.slice(0, 7), 1);
  const days = daysInMonth(month).filter((d) => !isWeekend(d)).slice(0, 8);
  const shifts = {};
  const requests = {};
  let t = Date.parse(`${today}T08:00:00Z`);
  days.forEach((date, di) => {
    for (const slot of ['am', 'pm']) {
      const id = shiftId(date, slot);
      shifts[`s_${date}_${slot}`] = { id, date, slot, needed: slot === 'am' ? 2 : 1 };
      // People 1–4 sign up for most shifts; person 5 hasn't opened the link yet.
      for (let w = 1; w <= 4; w++) {
        if ((w + di + (slot === 'pm' ? 1 : 0)) % 3 === 0) continue;
        t += 60000;
        requests[`r_${id}_${w}`] = { shiftId: id, workerId: w, status: 'pending', createdAt: new Date(t).toISOString() };
      }
    }
  });

  return {
    workers,
    shifts,
    requests,
    settings: {
      main: {
        clinicName: 'Klinika Zdravje',
        amStart: '08:00',
        amEnd: '14:00',
        pmStart: '14:00',
        pmEnd: '20:00',
        contactPhone: '041 000 999',
      },
    },
  };
}
