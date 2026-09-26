import test from 'node:test';
import assert from 'node:assert/strict';
import { smartAssign } from '../lib/assign.js';

const hours = { am: 6, pm: 6 };
const shift = (id, date, slot, needed, requests) => ({
  id, date, slot, needed,
  requests: requests.map(([workerId, status = 'pending']) => ({ workerId, status })),
});

test('spreads shifts evenly between people who asked for the same dates', () => {
  const shifts = [];
  for (let d = 1; d <= 10; d++) {
    const date = `2026-10-${String(d).padStart(2, '0')}`;
    shifts.push(shift(d, date, 'am', 1, [[1], [2]]));
  }
  const res = smartAssign({ shifts, hours, activeWorkerIds: new Set([1, 2]), today: '2026-10-01' });
  assert.equal(res.length, 10);
  const count = (w) => res.filter((r) => r.workerId === w).length;
  assert.equal(count(1), 5);
  assert.equal(count(2), 5);
});

test('never fills more than the needed number of people', () => {
  const shifts = [shift(1, '2026-10-05', 'am', 2, [[1], [2], [3], [4]])];
  const res = smartAssign({ shifts, hours, activeWorkerIds: new Set([1, 2, 3, 4]), today: '2026-10-01' });
  assert.equal(res.length, 2);
});

test('counts already approved hours and only fills remaining spots', () => {
  const shifts = [
    shift(1, '2026-10-02', 'am', 1, [[1, 'approved']]),
    shift(2, '2026-10-03', 'am', 1, [[1, 'approved']]),
    shift(3, '2026-10-04', 'am', 2, [[1], [2], [3, 'approved']]),
  ];
  const res = smartAssign({ shifts, hours, activeWorkerIds: new Set([1, 2, 3]), today: '2026-10-01' });
  assert.deepEqual(res, [{ shiftId: 3, workerId: 2 }]);
});

test('does not give one person both shifts on the same day', () => {
  const shifts = [
    shift(1, '2026-10-05', 'am', 1, [[1]]),
    shift(2, '2026-10-05', 'pm', 1, [[1], [2]]),
  ];
  const res = smartAssign({ shifts, hours, activeWorkerIds: new Set([1, 2]), today: '2026-10-01' });
  assert.deepEqual(res.sort((a, b) => a.shiftId - b.shiftId), [
    { shiftId: 1, workerId: 1 },
    { shiftId: 2, workerId: 2 },
  ]);
});

test('fills the hardest shifts first so nobody is left without cover', () => {
  // Worker 1 is the only one for shift 2; shift 1 has two candidates.
  const shifts = [
    shift(1, '2026-10-05', 'am', 1, [[1], [2]]),
    shift(2, '2026-10-06', 'am', 1, [[1]]),
    shift(3, '2026-10-07', 'am', 1, [[2]]),
  ];
  const res = smartAssign({ shifts, hours, activeWorkerIds: new Set([1, 2]), today: '2026-10-01' });
  assert.equal(res.length, 3);
});

test('skips past shifts and inactive people', () => {
  const shifts = [
    shift(1, '2026-10-01', 'am', 1, [[1]]),
    shift(2, '2026-10-10', 'am', 1, [[2]]),
  ];
  const res = smartAssign({ shifts, hours, activeWorkerIds: new Set([1]), today: '2026-10-05' });
  assert.deepEqual(res, []);
});
